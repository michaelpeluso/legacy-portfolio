/*
$(".toggleImage").click(function () {
    const isRotated = $(".toggleImage").data("rotated");
    $(".toggleImage").css("transform", isRotated ? "rotate(0deg)" : "rotate(45deg)");
    $(".toggleImage").data("rotated", !isRotated);
});
*/

document.addEventListener("DOMContentLoaded", function () {
    const rotateables = document.querySelectorAll(".toggleImage");

    rotateables.forEach((element) => {
        element.addEventListener("click", function () {
            // Toggle the "rotate90" class on the clicked element
            this.classList.toggle("rotate90");
        });
    });
});
