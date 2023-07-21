$(".toggleButton").click(function () {
    const isRotated = $(this).data("rotated");
    $(this).css("transform", isRotated ? "rotate(0deg)" : "rotate(45deg)");
    $(this).data("rotated", !isRotated);
});
