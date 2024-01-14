document.addEventListener("DOMContentLoaded", function () {
    /* HTML injection */
    fetch("/templates/head.html")
        .then((response) => response.text())
        .then((data) => {
            $("head").prepend(data);
            $("nav").addClass("sticky-top");
        });
    fetch("/templates/nav.html")
        .then((response) => response.text())
        .then((data) => {
            $("nav").html(data);

            var currentFile = window.location.pathname.split("/")[1];
            if (currentFile == "index.html") {
                $("#nav-home").addClass("active");
            } else {
                $("#nav-" + currentFile).addClass("active");
            }
        });
    fetch("/templates/footer.html")
        .then((response) => response.text())
        .then((data) => {
            $("footer").html(data);
        });

    // Button icon rotation
    const rotateables = document.querySelectorAll(".toggleImage");
    rotateables.forEach((element) => {
        element.addEventListener("click", function () {
            // Toggle the "rotate90" class on the clicked element
            this.classList.toggle("rotate90");
        });
    });

    // Smooth scroll to top
    $("#scrollToTop").click(function () {
        $("body,html").animate(
            {
                scrollTop: 0,
            },
            800
        );
        return false;
    });
});
