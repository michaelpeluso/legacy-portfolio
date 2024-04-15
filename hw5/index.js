/* VARIABLES */

// imported variables
const video = document.getElementById('webcam');
const canvas = document.getElementById('webcam_processed');
const motionIndicator = document.getElementById('motion-indicator');
const ctx = canvas.getContext('2d');
const totalPixels = canvas.width * canvas.height;

// cache variables
let prevFrame = null;
let motionDetected = false;
let changedPixelsList = [];
let highlights = [];

// user defined variables
let frameDelayMilliseconds = 40;
let pixelChangeThreshold = 40; // 0 - 255
let pixelCountThreshold = totalPixels * 0.1;
let minPixelGroup = 250;
let minBoxDistance = 200;
let gaussianFilterRadius = 1;



/* USER VARIABLE FUNCTIONS */

// update user defined variables 
function updateVariables() {
    frameDelayMilliseconds = parseInt(document.getElementById("frame-delay").value);
    document.getElementById("frame-delay-value").textContent = frameDelayMilliseconds;

    pixelChangeThreshold = parseInt(document.getElementById("pixel-change-threshold").value);
    document.getElementById("pixel-change-threshold-value").textContent = pixelChangeThreshold;

    minPixelGroup = parseInt(document.getElementById("min-pixel-group").value);
    document.getElementById("min-pixel-group-value").textContent = minPixelGroup;

    minBoxDistance = parseInt(document.getElementById("min-box-distance").value);
    document.getElementById("min-box-distance-value").textContent = minBoxDistance;

    pixelCountThreshold = (totalPixels * parseFloat(document.getElementById("pixel-count-threshold").value));
    document.getElementById("pixel-count-threshold-value").textContent = parseInt(document.getElementById("pixel-count-threshold").value * 100) + "%";

    gaussianFilterRadius = parseInt(document.getElementById("gaussian-filter-radius").value);
    document.getElementById("gaussian-filter-radius-value").textContent = gaussianFilterRadius;
}

// add event listeners to each slider
document.getElementById("frame-delay").addEventListener("input", updateVariables);
document.getElementById("pixel-change-threshold").addEventListener("input", updateVariables);
document.getElementById("min-pixel-group").addEventListener("input", updateVariables);
document.getElementById("min-box-distance").addEventListener("input", updateVariables);
document.getElementById("pixel-count-threshold").addEventListener("input", updateVariables);
document.getElementById("gaussian-filter-radius").addEventListener("input", updateVariables);


/* FRAME RATE FUNCTIONS */

// Get live video feed
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
        video.onloadedmetadata = () => video.play();
    })
    .catch(err => console.error('Error accessing camera:', err));


// Function to process frames at a controlled frame rate
function processFrames() {
    setTimeout(() => {
        motionIndicator.classList.remove('active');
        detectMotion();
        processFrames(); // Schedule the next frame processing
    }, frameDelayMilliseconds);
}


/* DETECT MOTION FUNCTION */

// main detection function to repeat over every frame
function detectMotion() {
    // Capture current frame from video
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    let currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Convert current frame to grayscale
    convertToGrayscale(ctx, currentFrame);

    // Apply GaussianBlur filter
    applyGaussianBlur(ctx, currentFrame, gaussianFilterRadius);

    // ignore equivalent frames
    if (!prevFrame) {
        prevFrame = currentFrame;
        return;
    }

    // Clear the list before detecting motion
    changedPixelsList = locatedChangedPixels(prevFrame, currentFrame, pixelChangeThreshold); 

    // Update motion detection flag (account for all 4 values)
    motionDetected = changedPixelsList.length / 4 > pixelCountThreshold;

    // highlight motion
    highlightMotion(changedPixelsList);
    
    // draw red rectangle around motion
    if (motionDetected) {
        locateMotion(changedPixelsList);
    }
    
    prevFrame = currentFrame;
}


/* HELPER FUNCTIONS */

// located changed pixels
function locatedChangedPixels(prevFrame, currentFrame, threshold) {
    // restructure variables
    const { data: prevData } = prevFrame;
    const { data: currentData } = currentFrame;
    changedPixelsList = [];

    // compare pixels between frames
    for (let i = 0; i < currentData.length; i += 4) {
        const diff = Math.abs(currentData[i] - prevData[i]);
        if (diff > threshold) {
            const x = (i / 4) % canvas.width;
            const y = Math.floor((i / 4) / canvas.width);
            changedPixelsList.push({ x, y });
        }
    }

    return changedPixelsList;
}

// convert image to grayscale
function convertToGrayscale(ctx, imageData) {
    const data = imageData.data;
    const length = data.length;

    for (let i = 0; i < length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // apply grayscale filter
        const grayscaleValue = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        data[i] = data[i + 1] = data[i + 2] = grayscaleValue;
    }

    ctx.putImageData(imageData, 0, 0);
}


// Gaussian blur filter for grayscale image
function applyGaussianBlur(ctx, imageData, radius) {
    const width = imageData.width;
    const height = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);

    // sum of the weights
    const weights = calculateGaussianWeights(radius);
    const factor = weights.reduce((acc, val) => acc + val, 0);

    // compute weighted sums for each weight
    const weightedSums = weights.map(w => w / factor);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let intensity = 0;

            // apply gaussian blur
            for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                    const px = Math.min(width - 1, Math.max(0, x + kx));
                    const py = Math.min(height - 1, Math.max(0, y + ky));
                    const index = py * width + px;

                    intensity += data[index] * weightedSums[(ky + radius) * (2 * radius + 1) + (kx + radius)];
                }
            }

            const dataIndex = y * width + x;
            data[dataIndex] = intensity;
        }
    }

    ctx.putImageData(new ImageData(data, width, height), 0, 0);
}


// calculate Gaussian weights based on radius
function calculateGaussianWeights(radius) {
    const weights = [];
    const sigma = radius / 2.0;
    const factor = 1 / (sigma * Math.sqrt(2 * Math.PI));

    for (let i = -radius; i <= radius; i++) {
        const weight = factor * Math.exp(-(i * i) / (2 * sigma * sigma));
        weights.push(weight);
    }

    return weights;
}


// find groups of adjacent marked pixels
function findMotionGroups(changedPixelsList) {
    const visited = new Set();
    const groups = [];

    // keep track of unmarked pixels
    const unmarkedPixels = new Set(changedPixelsList.map(({ x, y }) => `${x},${y}`));

    // nested function to check if a pixel is marked
    const isUnmarked = ({ x, y }) => unmarkedPixels.has(`${x},${y}`);

    // check each marked pixel to adjacent marked pixels
    for (const { x, y } of changedPixelsList) {
         // skip marked pixels
        if (!isUnmarked({ x, y })) continue;

        const stack = [{ x, y }];
        const group = [];

        while (stack.length > 0) {
            const { x, y } = stack.pop();

            // skip marked pixels
            if (!isUnmarked({ x, y })) continue;

            unmarkedPixels.delete(`${x},${y}`);
            group.push({ x, y });

            // Explore adjacent pixels
            stack.push({ x: x + 1, y });
            stack.push({ x: x - 1, y });
            stack.push({ x, y: y + 1 });
            stack.push({ x, y: y - 1 });
        }

        if (group.length > 0) {
            groups.push(group);
        }
    }

    return groups;
}


// highlight marked pixels / motion
function highlightMotion(changedPixelsList) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    for (const { x, y } of changedPixelsList) {
        ctx.fillRect(x, y, 1, 1);
    }
}


// draw squares around marked groups
function locateMotion(changedPixelsList) {
    const motionGroups = findMotionGroups(changedPixelsList);
    const boundingBoxes = [];

    for (const group of motionGroups) {
        if (group.length > minPixelGroup) {
            let minX = canvas.width;
            let minY = canvas.height;
            let maxX = 0;
            let maxY = 0;

            // get bounding box of the group
            for (const { x, y } of group) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }

            // Store the bounding box
            boundingBoxes.push({ minX, minY, maxX, maxY });
        }
    }

    // join intersecting bounding boxes and remove inner boxes
    const joinedBoxes = joinBoundingBoxes(boundingBoxes);

    // draw bounding boxes
    for (const { minX, minY, maxX, maxY } of joinedBoxes) {
        const width = maxX - minX;
        const height = maxY - minY;

        if (width > 0 && height > 0) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.strokeRect(minX, minY, width, height);

            // update motion indicator and log
            updateIndicatorAndLog(true)
        }
    }
}


// join intersecting bounding boxes and remove inner boxes
function joinBoundingBoxes(boxes) {
    // Sort boxes by area in descending order
    const sortedBoxes = boxes.sort((a, b) => {
        const areaA = (a.maxX - a.minX) * (a.maxY - a.minY);
        const areaB = (b.maxX - b.minX) * (b.maxY - b.minY);
        return areaB - areaA;
    });

    const joinedBoxes = [];

    // loop through each box
    for (const box of sortedBoxes) {
        let joined = false;
        let isInnerBox = false;

        for (const joinedBox of joinedBoxes) {
            // box is completely inside another box
            if (box.minX >= joinedBox.minX && 
                box.maxX <= joinedBox.maxX && 
                box.minY >= joinedBox.minY && 
                box.maxY <= joinedBox.maxY
            ) {
                isInnerBox = true;
                break;
            }

            // calculate distance between boxes centers
            const boxACenterX = (box.minX + box.maxX) / 2;
            const boxACenterY = (box.minY + box.maxY) / 2;
            const boxBCenterX = (joinedBox.minX + joinedBox.maxX) / 2;
            const boxBCenterY = (joinedBox.minY + joinedBox.maxY) / 2;
            const distance = Math.sqrt((boxACenterX - boxBCenterX) ** 2 + (boxACenterY - boxBCenterY) ** 2);

            // Check if boxes are too close or intersecting
            const intersecting = !(
                box.maxX < joinedBox.minX || box.minX > joinedBox.maxX ||
                box.maxY < joinedBox.minY || box.minY > joinedBox.maxY
            );

            if (distance <= minBoxDistance || intersecting) {
                joinedBox.minX = Math.min(joinedBox.minX, box.minX);
                joinedBox.minY = Math.min(joinedBox.minY, box.minY);
                joinedBox.maxX = Math.max(joinedBox.maxX, box.maxX);
                joinedBox.maxY = Math.max(joinedBox.maxY, box.maxY);
                joined = true;
                break;
            }
        }

        // add the box if it didn't join with existing boxes and isn't an inner box
        if (!joined && !isInnerBox) {
            joinedBoxes.push({ ...box }); 
        }
    }

    return joinedBoxes;
}


// Function to update the motion indicator
function updateIndicatorAndLog(motionDetected) {
        motionIndicator.classList.add('active');
        
            const currentTime = new Date().toLocaleTimeString();
        if (log.firstChild == null || log.firstChild.textContent !== `Motion detected at ${currentTime}`) {
            const logEntry = document.createElement('div');
            logEntry.textContent = `Motion detected at ${currentTime}`;
            log.insertBefore(logEntry, log.firstChild);
        }
}


/* PLAY VIDEOS */
video.addEventListener('play', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    requestAnimationFrame(processFrames);
});
