$(".toggleImage").click(function () {
    const isRotated = $(".toggleImage").data("rotated");
    $(".toggleImage").css("transform", isRotated ? "rotate(0deg)" : "rotate(45deg)");
    $(".toggleImage").data("rotated", !isRotated);
});
