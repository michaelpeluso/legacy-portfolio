let isRotated = false;
$("#toggleButton").click(function () {
    $("#toggleButton").css("transform", isRotated ? "rotate(0deg)" : "rotate(45deg)");
    isRotated = !isRotated;
});
