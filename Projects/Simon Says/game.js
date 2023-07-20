var gamePattern = [];
var userClickedPattern = [];
var buttonColors = ["red", "blue", "green", "yellow"];
var level = 0;

$(document).keypress(function (e) {
    if (level == 0) {
        nextSequence();
    }
});

$(".btn").click(function () {
    var userChosenColor = $(this).attr("id");
    userClickedPattern.push(userChosenColor);
    playSound(userChosenColor);
    checkAnswer(userClickedPattern.length - 1);
});

function nextSequence() {
    var range = buttonColors.length;
    var randomNumber = Math.floor(Math.random() * range);
    var randomChosenColor = buttonColors[randomNumber];

    userClickedPattern = [];
    gamePattern.push(randomChosenColor);
    playSound(randomChosenColor);
    level++;
    $("h1").text("level " + level);

    $(".btn#" + randomChosenColor)
        .fadeOut(100)
        .fadeIn(100)
        .fadeOut(100)
        .fadeIn(100);
}

function playSound(name) {
    var audio = new Audio("sounds/" + name + ".mp3");
    audio.play();
}

function animatePress(currentColor) {
    $("#" + currentColor).addClass("pressed");
    setTimeout(function () {
        $("#" + currentColor).removeClass("pressed");
    }, 100);
}

function checkAnswer(currentLevel) {
    if (gamePattern[currentLevel] === userClickedPattern[currentLevel]) {
        console.log("success");
    } else {
        $("body").addClass("game-over");
        setTimeout(function () {
            $("body").removeClass("game-over");
        }, 200);

        $("h1").text("Game Over. Press Any Key to Restart");
        startOver();
    }
    if (userClickedPattern.length === gamePattern.length) {
        setTimeout(nextSequence, 1000);
    }
}

function startOver() {
    level = 0;
    gamePattern = [];
}
