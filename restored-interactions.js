(function () {
  function initPurchaseFlow() {
    var input = document.querySelector('.creamy-product-quantity-0-x-quantityInput');
    var decrement = document.querySelector('.creamy-product-quantity-0-x-quantityButtonDecrement');
    var increment = document.querySelector('.creamy-product-quantity-0-x-quantityButtonIncrement');
    if (!input || !decrement || !increment) return;

    fetch('/api/cart', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stage', stage: 'product' })
    }).catch(function () {});

    function quantity() {
      return Math.max(1, Math.min(99999, parseInt(input.value, 10) || 1));
    }
    function render(value) {
      value = Math.max(1, Math.min(99999, value));
      input.value = value < 10 ? '0' + value : String(value);
      input.setAttribute('value', input.value);
      decrement.disabled = value <= 1;
    }
    decrement.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      render(quantity() - 1);
    }, true);
    increment.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      render(quantity() + 1);
    }, true);
    input.addEventListener('change', function () { render(quantity()); });

    document.addEventListener('click', async function (event) {
      var candidateButton = event.target && event.target.closest ? event.target.closest('button') : null;
      var buyButton = candidateButton && candidateButton.querySelector('.vtex-add-to-cart-button-0-x-buttonText--pdp-buy-button-fac-0001')
        ? candidateButton
        : null;
      if (!buyButton) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      var cartResponse = await fetch('/api/cart', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate',
          quantity: quantity(),
          activationToken: window.crypto && window.crypto.randomUUID
            ? window.crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).slice(2)
        })
      });
      if (!cartResponse.ok) return;
      window.location.href = 'Creamy%20-%20Finalizar%20compra.html#/orderform';
    }, true);
    render(quantity());
  }

  function removeInactiveShowcases() {
    var selectors = [
      '#beon-region-d68c9836-e99f-4004-b150-1ca578e170fd',
      '.vtex-render__container-id-relatedproducts-01',
      '.vtex-render__container-id-relatedproducts-02'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var section = document.querySelector(selectors[i]);
      if (section) section.remove();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      removeInactiveShowcases();
      initPurchaseFlow();
    }, { once: true });
  } else {
    removeInactiveShowcases();
    initPurchaseFlow();
  }

  function toggleProduct(header) {
    var section = header.closest('.creamy-custom-apps-0-x-productAccordion__section');
    var wrapper = section && section.querySelector('.creamy-custom-apps-0-x-productAccordion__contentWrapper');
    var content = wrapper && wrapper.querySelector('.creamy-custom-apps-0-x-productAccordion__content');
    if (!wrapper || !content) return;
    var opening = wrapper.classList.contains('creamy-custom-apps-0-x-productAccordion__collapsed');
    wrapper.classList.toggle('creamy-custom-apps-0-x-productAccordion__collapsed', !opening);
    wrapper.style.maxHeight = opening ? content.scrollHeight + 'px' : '0px';
    header.setAttribute('aria-expanded', String(opening));
    var icon = header.querySelector('svg');
    if (icon) {
      icon.style.transition = 'transform .25s ease';
      icon.style.transform = opening ? 'rotate(45deg)' : 'rotate(0deg)';
    }
  }

  function toggleFaq(trigger) {
    var item = trigger.closest('.creamy-custom-apps-0-x-tabs-accordion__tab-container__items__item');
    var content = item && item.querySelector('.creamy-custom-apps-0-x-tabs-accordion__tab-container__items__item__content');
    var icon = item && item.querySelector('.creamy-custom-apps-0-x-tabs-accordion__tab-container__items__item__trigger__state-icon');
    if (!content) return;
    var closed = 'creamy-custom-apps-0-x-tabs-accordion__tab-container__items__item__content--closed';
    var iconClosed = 'creamy-custom-apps-0-x-tabs-accordion__tab-container__items__item__trigger__state-icon--closed';
    var opening = content.classList.contains(closed);
    content.classList.toggle(closed, !opening);
    if (icon) {
      icon.classList.toggle(iconClosed, !opening);
      icon.style.transition = 'transform .25s ease';
      icon.style.transform = opening ? 'rotate(45deg)' : 'rotate(0deg)';
    }
    trigger.setAttribute('aria-expanded', String(opening));
  }

  function toggleSeo(button) {
    var box = button.closest('.text-seo-accordion-container');
    var description = box && box.querySelector('.text-seo-accordion-description');
    if (!description) return;
    var opening = description.classList.contains('text-seo-accordion-description-closed');
    description.classList.toggle('text-seo-accordion-description-closed', !opening);
    description.style.maxHeight = opening ? description.scrollHeight + 'px' : '46px';
    var label = button.querySelector('span');
    if (label) label.textContent = opening ? 'LER MENOS' : 'LER MAIS';
    var icon = button.querySelector('img');
    if (icon) icon.style.transform = opening ? 'rotate(180deg)' : 'rotate(0deg)';
    button.setAttribute('aria-expanded', String(opening));
  }

  function moveCarousel(control) {
    var container = document.querySelector('.creamy-product-images-custom-0-x-productImagesGallerySwiperContainer');
    var wrapper = container && container.querySelector('.swiper-wrapper');
    var slides = wrapper ? wrapper.querySelectorAll('.swiper-slide') : [];
    if (!wrapper || slides.length < 2) return;
    var current = Number(wrapper.getAttribute('data-restored-index') || 0);
    var next = control.classList.contains('creamy-product-images-custom-0-x-swiperCaretNext');
    current = next ? Math.min(current + 1, slides.length - 1) : Math.max(current - 1, 0);
    wrapper.setAttribute('data-restored-index', String(current));
    wrapper.style.transition = 'transform .35s ease';
    wrapper.style.transform = 'translate3d(-' + (current * 100) + '%,0,0)';
    for (var i = 0; i < slides.length; i++) {
      slides[i].classList.toggle('swiper-slide-active', i === current);
      slides[i].classList.toggle('swiper-slide-next', i === current + 1);
    }
    var bullets = document.querySelectorAll('.creamy-product-images-custom-0-x-swiper-pagination .swiper-pagination-bullet');
    for (var j = 0; j < bullets.length; j++) bullets[j].classList.toggle('swiper-pagination-bullet-active', j === current);
    var prev = document.querySelector('.creamy-product-images-custom-0-x-swiperCaretPrev');
    var nextButton = document.querySelector('.creamy-product-images-custom-0-x-swiperCaretNext');
    if (prev) prev.classList.toggle('c-disabled', current === 0);
    if (nextButton) nextButton.classList.toggle('c-disabled', current === slides.length - 1);
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target : null;
    if (!target) return;
    var product = target.closest('.creamy-custom-apps-0-x-productAccordion__header');
    if (product) return toggleProduct(product);
    var faq = target.closest('.creamy-custom-apps-0-x-tabs-accordion__tab-container__items__item__trigger');
    if (faq) return toggleFaq(faq);
    var seo = target.closest('.text-seo-accordion-btn-after-description, .text-seo-accordion-btn-title');
    if (seo) return toggleSeo(seo);
    var carousel = target.closest('.creamy-product-images-custom-0-x-swiperCaretPrev, .creamy-product-images-custom-0-x-swiperCaretNext');
    if (carousel) return moveCarousel(carousel);
  }, true);
})();
