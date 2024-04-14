const video = document.getElementById('webcam');
const canvas = document.getElementById('webcam_processed');
const motionIndicator = document.getElementById('motion-indicator');
const ctx = canvas.getContext('2d');
const totalPixels = canvas.width * canvas.height;

const frameDelayMilliseconds = 40;
const pixelChangeThreshold = 35; // 0 - 255
const pixelCountThreshold = totalPixels * 0;
const medianFilterRadius = 2;
const minPixelGroup = 250;
const minBoxDistance = 200;

let prevFrame = null;
let motionDetected = false;
let changedPixelsList = [];
let highlights = [];

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

// repeat over every frame
function detectMotion() {
    // Capture current frame from video
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    let currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Convert current frame to grayscale
    convertToGrayscale(ctx, currentFrame);

    // Apply GaussianBlur filter
    applyGaussianBlur(ctx, currentFrame, medianFilterRadius);

    if (!prevFrame) {
        prevFrame = currentFrame;
        return;
    }

    // restructure variables
    const { data: prevData } = prevFrame;
    const { data: currentData } = currentFrame;

    // Clear the list before detecting motion
    changedPixelsList = []; 

    // compare grayscale pixels between two frames and track changed pixels
    for (let i = 0; i < currentData.length; i += 4) {
        const diff = Math.abs(currentData[i] - prevData[i]); // Compare R channel
        if (diff > pixelChangeThreshold) {
            const x = (i / 4) % canvas.width;
            const y = Math.floor((i / 4) / canvas.width);
            changedPixelsList.push({ x, y }); // Add changed pixel coordinates to the list
        }
    }

    // Update motion detection flag
    motionDetected = changedPixelsList.length > pixelCountThreshold;

    // highlight motion
    highlightMotion(changedPixelsList);
    
    // draw red rectangle around motion
    if (motionDetected) {
        locateMotion(changedPixelsList);
    }
    
    prevFrame = currentFrame;
}

// Convert entire image to grayscale
function convertToGrayscale(ctx, imageData) {
    const data = imageData.data;
    const length = data.length;

    for (let i = 0; i < length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Apply grayscale conversion formula
        const grayscaleValue = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        // Set the RGB channels to the grayscale value
        data[i] = data[i + 1] = data[i + 2] = grayscaleValue;
    }

    // Put the modified image data back onto the canvas
    ctx.putImageData(imageData, 0, 0);
}


// Gaussian blur function with customizable radius for grayscale image
function applyGaussianBlur(ctx, imageData, radius) {
    const width = imageData.width;
    const height = imageData.height;
    const data = new Uint8ClampedArray(imageData.data); // Create a copy of the image data

    const weights = calculateGaussianWeights(radius);
    const factor = weights.reduce((acc, val) => acc + val, 0); // Sum of the weights

    // Compute weighted sums for each weight
    const weightedSums = weights.map(w => w / factor);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let intensity = 0;

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

    // Put the modified image data back onto the canvas
    ctx.putImageData(new ImageData(data, width, height), 0, 0);
}


// Helper function to calculate Gaussian weights based on radius
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


function findMotionGroups(changedPixelsList) {
    const visited = new Set(); // Set to keep track of visited pixels
    const groups = []; // Array to store information about each group

    // Create a set to keep track of unmarked pixels
    const unmarkedPixels = new Set(changedPixelsList.map(({ x, y }) => `${x},${y}`));

    // Function to check if a pixel is unmarked
    const isUnmarked = ({ x, y }) => unmarkedPixels.has(`${x},${y}`);

    for (const { x, y } of changedPixelsList) {
        if (!isUnmarked({ x, y })) continue; // Skip marked pixels

        const stack = [{ x, y }]; // Initialize stack with the current pixel
        const group = []; // Array to store pixels in the current group

        while (stack.length > 0) {
            const { x, y } = stack.pop(); // Pop the top pixel from the stack

            if (!isUnmarked({ x, y })) continue; // Skip marked pixels

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


// highlight motion
function highlightMotion(changedPixelsList) {
    // Fill the entire canvas with black
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Mark changed pixels as white
    ctx.fillStyle = 'white';
    for (const { x, y } of changedPixelsList) {
        ctx.fillRect(x, y, 1, 1);
    }
}

// Modify the locateMotion function to call findMotionGroups and draw squares around large groups
function locateMotion(changedPixelsList) {
    // Find motion groups
    const motionGroups = findMotionGroups(changedPixelsList);

    // Initialize an array to store bounding boxes
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

    // Join intersecting bounding boxes and remove inner boxes
    const joinedBoxes = joinBoundingBoxes(boundingBoxes);

    // Draw the cleaned and joined bounding boxes
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

// Function to join intersecting bounding boxes and remove inner boxes
function joinBoundingBoxes(boxes) {
    // Sort boxes by area in descending order
    const sortedBoxes = boxes.sort((a, b) => {
        const areaA = (a.maxX - a.minX) * (a.maxY - a.minY);
        const areaB = (b.maxX - b.minX) * (b.maxY - b.minY);
        return areaB - areaA;
    });

    const joinedBoxes = [];

    for (const box of sortedBoxes) {
        let joined = false;
        let isInnerBox = false;

        for (const joinedBox of joinedBoxes) {
            if (
                box.minX >= joinedBox.minX && box.maxX <= joinedBox.maxX &&
                box.minY >= joinedBox.minY && box.maxY <= joinedBox.maxY
            ) {
                // Box is completely inside another box, mark as inner box
                isInnerBox = true;
                break;
            }

            // Calculate the distance between boxes' centers
            const boxACenterX = (box.minX + box.maxX) / 2;
            const boxACenterY = (box.minY + box.maxY) / 2;
            const boxBCenterX = (joinedBox.minX + joinedBox.maxX) / 2;
            const boxBCenterY = (joinedBox.minY + joinedBox.maxY) / 2;
            const distance = Math.sqrt((boxACenterX - boxBCenterX) ** 2 + (boxACenterY - boxBCenterY) ** 2);

            // Check if boxes are within the threshold distance apart or intersecting
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

        if (!joined && !isInnerBox) {
            joinedBoxes.push({ ...box }); // Add the box if it did not join with any existing box and is not an inner box
        }
    }

    return joinedBoxes;
}


// play video
video.addEventListener('play', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    requestAnimationFrame(processFrames);
});


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