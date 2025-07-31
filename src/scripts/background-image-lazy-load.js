/*
 * NOTE: Not optimized for responsive images yet!
 *
 * Adds lazy loading to background images on divs
 *
 * usage: add data-bg-image attribute to div
 * ex: <div class="hero-section" data-bg-image="path/to/image.jpg"></div>
 */
$(document).ready(function () {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const div = entry.target;
        const imageUrl = div.dataset.bgImage;
        div.style.backgroundImage = `url(${imageUrl})`;
        div.classList.add("loaded");
        observer.unobserve(div);
      }
    });
  });

  // Apply to all divs with data-bg-image attribute
  document.querySelectorAll("[data-bg-image]").forEach((div) => {
    imageObserver.observe(div);
  });
});
