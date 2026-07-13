(function () {
  var serverCart = null;

  async function cartRequest(action, payload) {
    var response = await fetch('/api/cart', {
      method: action ? 'POST' : 'GET',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: action ? JSON.stringify(Object.assign({ action: action }, payload || {})) : undefined
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falha ao atualizar o pedido');
    serverCart = data;
    return data;
  }

  async function applyStoredCartQuantity(nextQuantity) {
    var cart = nextQuantity == null
      ? await cartRequest()
      : await cartRequest('quantity', { quantity: nextQuantity });
    var quantity = cart.quantity;
    var subtotal = cart.totals.subtotal / 100;
    var total = cart.totals.total / 100;
    var discount = cart.totals.discount / 100;
    var mainListTotal = (cart.product.listPrice * quantity) / 100;
    var mainSellingTotal = (cart.product.sellingPrice * quantity) / 100;
    function money(value) {
      return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    var quantityInputs = document.querySelectorAll('input[id^="item-quantity-"]');
    for (var i = 0; i < quantityInputs.length; i++) {
      quantityInputs[i].value = String(quantity);
      quantityInputs[i].setAttribute('value', String(quantity));
    }
    var itemPrices = document.querySelectorAll('.new-product-price:not(.restored-gift-price):not(.restored-addon-price)');
    for (var p = 0; p < itemPrices.length; p++) itemPrices[p].innerHTML = money(mainSellingTotal) + '<span class="pix-tag-checkout pix-tag-added"> no PIX</span>';
    var oldPrices = document.querySelectorAll('.old-product-price:not(.restored-addon-old-price)');
    for (var o = 0; o < oldPrices.length; o++) oldPrices[o].textContent = money(mainListTotal);

    var itemRow = document.querySelector('.summary-totalizers tr.Items .monetary, .totalizers-list tr.Items .monetary');
    var discountRow = document.querySelector('.summary-totalizers tr.Discounts .monetary, .totalizers-list tr.Discounts .monetary');
    var totalRow = document.querySelector('.summary-totalizers tr:not(.Items):not(.Discounts) .monetary, .totalizers-list tr:not(.Items):not(.Discounts) .monetary');
    if (itemRow) itemRow.textContent = money(subtotal);
    if (discountRow) discountRow.textContent = money(-discount);
    if (totalRow) totalRow.innerHTML = money(total) + '<span class="pix-tag-checkout pix-tag-added"> no PIX</span>';
    var fixedTotals = document.querySelectorAll('.checkout-fixed-value');
    for (var f = 0; f < fixedTotals.length; f++) fixedTotals[f].textContent = money(total) + ' no PIX';
  }

  function initCoupon() {
    var fieldset = document.querySelector('.coupon-fieldset');
    var addLink = document.querySelector('#cart-link-coupon-add');
    if (!fieldset || !addLink) return;

    function showCouponForm() {
      fieldset.innerHTML = '';
      var wrapper = document.createElement('div');
      wrapper.className = 'restored-coupon-confirmation';
      wrapper.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;';
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'restored-coupon-input';
      input.value = 'MEUKIT50OFF';
      input.readOnly = true;
      input.setAttribute('aria-label', 'Cupom de desconto');
      input.style.cssText = 'min-width:0;flex:1;height:40px;border:1px solid #cbcbcb;border-radius:100px;padding:0 14px;color:#424242;background:#fff;font-weight:600;box-sizing:border-box;';
      var confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.className = 'restored-coupon-apply';
      confirm.textContent = serverCart && serverCart.coupon ? 'Aplicado' : 'Confirmar';
      confirm.disabled = !!(serverCart && serverCart.coupon);
      confirm.style.cssText = 'height:40px;border:0;border-radius:100px;padding:0 16px;background:#194a97;color:#fff;font-weight:700;cursor:pointer;';
      confirm.addEventListener('click', async function () {
        await cartRequest('coupon', { code: 'MEUKIT50OFF' });
        confirm.textContent = 'Aplicado';
        confirm.disabled = true;
        confirm.style.background = '#3e7dbf';
        await applyStoredCartQuantity();
      });
      wrapper.appendChild(input);
      wrapper.appendChild(confirm);
      fieldset.appendChild(wrapper);
    }

    addLink.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showCouponForm();
    }, true);
    showCouponForm();
  }

  function initAddons() {
    function money(cents) {
      return 'R$ ' + (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function renderAddon(addon, sourceItem) {
      if (document.querySelector('.restored-addon-cart-item[data-addon-id="' + addon.id + '"]')) return;
      var body = document.querySelector('.cart-items tbody');
      if (!body) return;
      var image = sourceItem && sourceItem.querySelector('.beon-showcase__item-image img');
      var row = document.createElement('tr');
      row.className = 'product-item restored-addon-cart-item';
      row.setAttribute('data-addon-id', addon.id);
      row.innerHTML = '<td class="product-image">' + (image ? '<img src="' + image.src.replace(/"/g, '&quot;') + '" alt="">' : '') + '</td>' +
        '<td class="product-name"><span>' + addon.name + '</span><small style="display:block;color:#194a97;font-weight:600;margin-top:4px">Adicionado ao carrinho</small></td>' +
        '<td class="shipping-date empty"></td><td class="product-price"><span class="old-product-price restored-addon-old-price" style="display:block">' + money(addon.listPrice) + '</span><span class="new-product-price restored-addon-price">' + money(addon.sellingPrice) + ' <span class="pix-tag-checkout pix-tag-added">no PIX</span></span></td>' +
        '<td class="quantity"><span>1</span></td><td class="quantity-price"></td><td class="item-remove"></td>';
      body.appendChild(row);
    }

    var items = document.querySelectorAll('#beon-element-1735c46e-7cfe-48ef-a01d-f2812c583ff4 .beon-showcase__item');
    for (var i = 0; i < items.length; i++) {
      (function (item) {
        var button = item.querySelector('.beon-button--primary');
        var id = item.getAttribute('data-product-sku');
        if (!button || !id) return;
        button.removeAttribute('href');
        button.setAttribute('role', 'button');
        button.setAttribute('aria-label', 'Adicionar produto ao carrinho');
        button.addEventListener('click', async function (event) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (button.classList.contains('restored-addon-added')) return;
          button.style.pointerEvents = 'none';
          button.style.opacity = '.7';
          try {
            var cart = await cartRequest('addon', { addonId: id });
            var addon = cart.addons.find(function (entry) { return entry.id === id; });
            if (addon) renderAddon(addon, item);
            button.classList.add('restored-addon-added');
            button.style.background = '#3e7dbf';
            button.setAttribute('aria-label', 'Produto adicionado ao carrinho');
            await applyStoredCartQuantity();
          } finally {
            button.style.pointerEvents = '';
            button.style.opacity = '';
          }
        }, true);
      })(items[i]);
    }
    if (serverCart && serverCart.addons) {
      for (var a = 0; a < serverCart.addons.length; a++) {
        var source = document.querySelector('.beon-showcase__item[data-product-sku="' + serverCart.addons[a].id + '"]');
        renderAddon(serverCart.addons[a], source);
        var sourceButton = source && source.querySelector('.beon-button--primary');
        if (sourceButton) sourceButton.classList.add('restored-addon-added');
      }
    }
  }

  function initCartAdvance() {
    var continueWrapper = document.querySelector('.link-choose-more-products-wrapper');
    if (continueWrapper) continueWrapper.remove();
    var advance = document.querySelector('#cart-to-orderform');
    var cart = document.querySelector('.cart-template.full-cart');
    var orderform = document.querySelector('.orderform-template');
    var holder = orderform && orderform.querySelector('.orderform-template-holder');
    if (!advance || !cart || !orderform || !holder) return;

    if (!holder.querySelector('.restored-identification')) {
      holder.classList.remove('sf-hidden');
      holder.innerHTML = '<section class="restored-identification" aria-labelledby="restored-identification-title" style="background:#fff;border-radius:16px;padding:24px;box-sizing:border-box;width:100%;max-width:720px;margin:0 auto">' +
        '<h2 id="restored-identification-title" style="margin:0 0 8px;color:#194a97;font-size:24px">Identificação</h2><p style="margin:0 0 22px;color:#676767">Informe seus dados para continuar com a entrega.</p>' +
        '<form class="restored-identification-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">' +
        '<label style="grid-column:1/-1">E-mail<input required type="email" autocomplete="email" name="email" style="display:block;width:100%;height:46px;margin-top:6px;border:1px solid #cbcbcb;border-radius:100px;padding:0 16px;box-sizing:border-box"></label>' +
        '<label>Nome<input required autocomplete="given-name" name="firstName" style="display:block;width:100%;height:46px;margin-top:6px;border:1px solid #cbcbcb;border-radius:100px;padding:0 16px;box-sizing:border-box"></label>' +
        '<label>Sobrenome<input required autocomplete="family-name" name="lastName" style="display:block;width:100%;height:46px;margin-top:6px;border:1px solid #cbcbcb;border-radius:100px;padding:0 16px;box-sizing:border-box"></label>' +
        '<label>CPF<input required inputmode="numeric" maxlength="14" name="document" style="display:block;width:100%;height:46px;margin-top:6px;border:1px solid #cbcbcb;border-radius:100px;padding:0 16px;box-sizing:border-box"></label>' +
        '<label>Celular<input required type="tel" autocomplete="tel" name="phone" style="display:block;width:100%;height:46px;margin-top:6px;border:1px solid #cbcbcb;border-radius:100px;padding:0 16px;box-sizing:border-box"></label>' +
        '</form></section>';
    }

    advance.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      cart.classList.remove('active');
      cart.style.display = 'none';
      orderform.classList.remove('inactive', 'sf-hidden');
      orderform.classList.add('active');
      orderform.style.cssText = 'display:flex;opacity:1;position:relative;margin-left:0;width:100%';
      window.location.hash = '#/orderform/profile';
      var steps = document.querySelectorAll('.dot-progress-bar');
      if (steps[1]) steps[1].click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, true);
  }

  function initCheckoutQuantity() {
    document.addEventListener('click', function (event) {
      var decrement = event.target && event.target.closest ? event.target.closest('.item-quantity-change-decrement') : null;
      var increment = event.target && event.target.closest ? event.target.closest('.item-quantity-change-increment') : null;
      if (!decrement && !increment) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      var row = (decrement || increment).closest('.product-item');
      var input = row ? row.querySelector('input[id^="item-quantity-"]') : document.querySelector('input[id^="item-quantity-"]');
      var current = Math.max(1, parseInt(input && input.value, 10) || 1);
      applyStoredCartQuantity(increment ? current + 1 : Math.max(1, current - 1));
    }, true);

    document.addEventListener('change', function (event) {
      if (!event.target.matches('input[id^="item-quantity-"]')) return;
      applyStoredCartQuantity(event.target.value);
    }, true);
  }

  function initCarousel() {
    var frames = document.querySelectorAll('.beon-slider__frame');
    for (var i = 0; i < frames.length; i++) {
      (function (frame) {
        var wrapper = frame.querySelector('.beon-showcase__items-wrapper');
        var slides = wrapper ? wrapper.querySelectorAll('.beon-slider__slide') : [];
        var prev = frame.querySelector('[data-controls="prev"]');
        var next = frame.querySelector('[data-controls="next"]');
        var dots = frame.querySelectorAll('.tns-nav button');
        if (!wrapper || slides.length < 2 || !prev || !next) return;
        var index = 0;

        function render() {
          var slideWidth = slides[0].getBoundingClientRect().width;
          var viewport = wrapper.parentElement.getBoundingClientRect().width;
          var visible = Math.max(1, Math.round(viewport / slideWidth));
          var max = Math.max(0, slides.length - visible);
          index = Math.max(0, Math.min(index, max));
          wrapper.style.transition = 'transform .35s ease';
          wrapper.style.transform = 'translate3d(-' + (index * slideWidth) + 'px,0,0)';
          prev.disabled = index === 0;
          next.disabled = index === max;
          for (var d = 0; d < dots.length; d++) {
            var active = d === Math.min(index, dots.length - 1);
            dots[d].classList.toggle('tns-nav-active', active);
            dots[d].setAttribute('aria-label', 'Carousel Page ' + (d + 1) + (active ? ' (Current Slide)' : ''));
          }
        }

        prev.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopImmediatePropagation();
          index--;
          render();
        }, true);
        next.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopImmediatePropagation();
          index++;
          render();
        }, true);
        for (var d = 0; d < dots.length; d++) {
          (function (dot, dotIndex) {
            dot.addEventListener('click', function (event) {
              event.preventDefault();
              event.stopImmediatePropagation();
              index = dotIndex;
              render();
            }, true);
          })(dots[d], d);
        }
        window.addEventListener('resize', render);
        render();
      })(frames[i]);
    }
  }

  function initShipping() {
    var shippingState = serverCart && serverCart.shipping ? serverCart.shipping : null;
    var delivery = document.querySelector('.srp-toggle__delivery');
    var pickup = document.querySelector('.srp-toggle__pickup');
    var frame = document.querySelector('.srp-toggle__current');
    var shippingContainer = document.querySelector('#custom-shipping-form-container');
    var status = document.querySelector('.restored-shipping-status');
    if (!status && shippingContainer) {
      status = document.createElement('div');
      status.className = 'restored-shipping-status';
      status.setAttribute('aria-live', 'polite');
      status.style.cssText = 'margin:4px 0 20px;color:#424242;font-size:13px;line-height:1.45;';
      shippingContainer.insertAdjacentElement('afterend', status);
    }

    function showLoading(message) {
      if (!status) return;
      status.innerHTML = '<span style="display:flex;align-items:center;gap:8px;color:#194a97;font-weight:600">' +
        '<svg class="restored-iconsax-loader" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="animation:restoredSpin .8s linear infinite">' +
        '<path d="M12 3a9 9 0 1 1-8.1 5.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M3 3v5h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' + message + '</span>';
      if (!document.querySelector('#restored-shipping-animation')) {
        var style = document.createElement('style');
        style.id = 'restored-shipping-animation';
        style.textContent = '@keyframes restoredSpin{to{transform:rotate(360deg)}}';
        document.head.appendChild(style);
      }
    }

    function showStatus(message, error) {
      if (!status) return;
      status.textContent = message;
      status.style.color = error ? '#b42318' : '#194a97';
      status.style.fontWeight = '600';
    }

    function renderShippingOptions(address) {
      if (!status) return;
      status.innerHTML = '';
      var title = document.createElement('div');
      title.textContent = 'Entrega em: ' + address + '.';
      title.style.cssText = 'color:#194a97;font-weight:600;margin-bottom:10px;';
      var option = document.createElement('label');
      option.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #194a97;border-radius:8px;padding:12px;cursor:pointer;color:#424242;';
      option.innerHTML = '<span><input type="radio" name="restored-shipping-rate" checked style="margin-right:8px">Entrega padrão<br><small style="margin-left:22px;color:#676767">Prazo estimado: 3 a 7 dias úteis</small></span><strong style="color:#194a97">Grátis</strong>';
      status.appendChild(title);
      status.appendChild(option);
    }

    async function findNearestStore() {
      var savedAddress = shippingState && shippingState.address;
      if (!savedAddress) {
        showStatus('Informe seu CEP em “Receba em Casa” antes de procurar uma loja.', true);
        return;
      }
      showLoading('Buscando a loja Creamy mais próxima...');
      try {
        var response = await fetch('/api/stores?address=' + encodeURIComponent(savedAddress));
        var store = await response.json();
        if (!response.ok) throw new Error(store.error || 'Nenhuma loja próxima');
        var message = 'Loja mais próxima: ' + store.name + (store.address ? ' — ' + store.address : '') + ' (' + store.distanceKm + ' km).';
        shippingState = { method: 'pickup', address: savedAddress, store: message };
        await cartRequest('shipping', { shipping: shippingState });
        showStatus(message);
      } catch (_) {
        showStatus('Não encontramos uma loja Creamy próxima. Só será possível receber em casa.', true);
      }
    }

    if (delivery && pickup && frame) {
      async function choose(mode, triggerSearch) {
        var isPickup = mode === 'pickup';
        frame.style.transition = 'transform .3s ease';
        frame.style.transform = isPickup ? 'translateX(100%)' : 'translateX(0)';
        frame.style.visibility = 'hidden';
        frame.classList.toggle('vtex-shipping-preview-0-x-frameDelivery', !isPickup);
        frame.classList.toggle('vtex-shipping-preview-0-x-framePickup', isPickup);
        delivery.classList.toggle('blue', !isPickup);
        pickup.classList.toggle('blue', isPickup);
        delivery.setAttribute('aria-selected', String(!isPickup));
        pickup.setAttribute('aria-selected', String(isPickup));
        delivery.classList.toggle('restored-shipping-selected', !isPickup);
        pickup.classList.toggle('restored-shipping-selected', isPickup);
        delivery.style.boxSizing = 'border-box';
        pickup.style.boxSizing = 'border-box';
        delivery.style.border = !isPickup ? '1px solid #0096bb' : '1px solid #cbcbcb';
        pickup.style.border = isPickup ? '1px solid #0096bb' : '1px solid #cbcbcb';
        delivery.style.borderRadius = '100px';
        pickup.style.borderRadius = '100px';
        delivery.style.boxShadow = !isPickup ? '0 2px 5px rgba(0,0,0,.16)' : 'none';
        pickup.style.boxShadow = isPickup ? '0 2px 5px rgba(0,0,0,.16)' : 'none';
        if (shippingContainer) shippingContainer.style.display = isPickup ? 'none' : 'flex';
        if (isPickup && triggerSearch) findNearestStore();
        else if (isPickup && status) status.textContent = (shippingState && shippingState.store) || 'Clique novamente em “Retire Numa Loja” para buscar uma unidade próxima.';
        else if (status && shippingState && shippingState.address) renderShippingOptions(shippingState.address);
        else if (status) status.textContent = '';
      }
      delivery.addEventListener('click', function () { choose('delivery', false); }, true);
      pickup.addEventListener('click', function () { choose('pickup', true); }, true);
      choose(shippingState && shippingState.method === 'pickup' ? 'pickup' : 'delivery', false);
    }

    var input = document.querySelector('.custom-shipping-input');
    var button = document.querySelector('.custom-shipping-button');
    var form = document.querySelector('#custom-shipping-form');
    if (!input || !button || !form) return;
    var unknownCepLink = document.querySelector('.custom-shipping-link');
    if (unknownCepLink) {
      unknownCepLink.removeAttribute('target');
      unknownCepLink.setAttribute('href', 'javascript:void(0)');
      unknownCepLink.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (document.querySelector('.restored-postal-search')) return;
        var search = document.createElement('div');
        search.className = 'restored-postal-search';
        search.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px;';
        search.innerHTML = '<input class="restored-postal-search-input" type="text" placeholder="Digite sua rua, cidade e estado" style="flex:1;min-width:190px;height:40px;border:1px solid #ccc;border-radius:100px;padding:0 14px;box-sizing:border-box">' +
          '<button class="restored-postal-search-button" type="button" style="height:40px;border:0;border-radius:100px;padding:0 16px;background:#194a97;color:#fff;font-weight:700">Buscar CEP</button>';
        status.insertAdjacentElement('beforebegin', search);
        search.querySelector('.restored-postal-search-button').addEventListener('click', async function () {
          var queryInput = search.querySelector('.restored-postal-search-input');
          if (!queryInput.value.trim()) return;
          showLoading('Buscando seu CEP...');
          try {
            var response = await fetch('/api/address-search?q=' + encodeURIComponent(queryInput.value.trim()));
            var result = await response.json();
            var postalCode = result.cep;
            if (!response.ok || !postalCode) throw new Error('postal code not found');
            var digits = postalCode.replace(/\D/g, '').slice(0, 8);
            input.value = digits.slice(0, 5) + '-' + digits.slice(5);
            button.disabled = digits.length !== 8;
            showStatus('CEP encontrado: ' + input.value + '. Confirme em “Calcular”.');
          } catch (_) {
            showStatus('Não foi possível encontrar o CEP. Tente informar mais detalhes do endereço.', true);
          }
        });
      }, true);
    }
    input.addEventListener('input', function () {
      var digits = input.value.replace(/\D/g, '').slice(0, 8);
      input.value = digits.length > 5 ? digits.slice(0, 5) + '-' + digits.slice(5) : digits;
      button.disabled = digits.length !== 8;
    });
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (button.disabled) return;
      button.textContent = 'Calculando...';
      button.disabled = true;
      button.style.transition = 'background-color .25s ease, transform .2s ease';
      button.style.transform = 'scale(.98)';
      setTimeout(function () { button.style.transform = 'scale(1)'; }, 180);
      try {
        var cep = input.value.replace(/\D/g, '');
        var cepResponse = await fetch('/api/cep?cep=' + encodeURIComponent(cep));
        var address = await cepResponse.json();
        if (!cepResponse.ok || !address || address.erro) throw new Error('invalid cep');
        var fullAddress = [address.logradouro, address.bairro, address.localidade, address.uf].filter(Boolean).join(', ');
        shippingState = { method: 'delivery', cep: cep, address: fullAddress };
        await cartRequest('shipping', { shipping: shippingState });
        showStatus('Entrega em: ' + fullAddress + '.');
        renderShippingOptions(fullAddress);
        button.textContent = 'Calculado';
      } catch (_) {
        showStatus('CEP não encontrado. Confira o número e tente novamente.', true);
        button.textContent = 'Calcular';
      }
      button.disabled = false;
    }, true);
  }

  function initGifts() {
    var gifts = document.querySelectorAll('.available-gift-item');
    async function updateGiftInCart(gift, selected) {
      var currentRow = document.querySelector('.restored-gift-cart-item');
      if (currentRow) currentRow.remove();
      if (!selected || !gift) {
        await cartRequest('gift', { giftId: null });
        return;
      }
      var name = (gift.querySelector('.product-name > span')?.textContent || gift.querySelector('.product-name')?.textContent || gift.textContent || '').trim();
      var image = gift.querySelector('.product-image img')?.getAttribute('src') || '';
      var id = gift.getAttribute('data-item-id') || name;
      await cartRequest('gift', { giftId: id });
      var body = document.querySelector('.cart-items tbody');
      if (!body) return;
      var row = document.createElement('tr');
      row.className = 'product-item restored-gift-cart-item';
      row.setAttribute('data-gift-id', id);
      row.innerHTML = '<td class="product-image">' +
        (image ? '<img src="' + image.replace(/"/g, '&quot;') + '" alt="' + name.replace(/"/g, '&quot;') + '">' : '') +
        '</td><td class="product-name"><span>' + name + '</span><small style="display:block;color:#194a97;font-weight:600;margin-top:4px">Brinde selecionado</small></td>' +
        '<td class="shipping-date empty"></td><td class="product-price"><span class="best-price"><span class="new-product-price restored-gift-price">Grátis</span></span></td>' +
        '<td class="quantity"><span>1</span></td><td class="quantity-price"></td><td class="item-remove"></td>';
      body.appendChild(row);
    }
    for (var i = 0; i < gifts.length; i++) {
      (function (gift) {
        gift.setAttribute('role', 'checkbox');
        gift.setAttribute('tabindex', '0');
        gift.setAttribute('aria-checked', 'false');
        gift.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopImmediatePropagation();
          var selected = !gift.classList.contains('active');
          if (selected) {
            for (var otherIndex = 0; otherIndex < gifts.length; otherIndex++) {
              var other = gifts[otherIndex];
              if (other === gift) continue;
              other.classList.remove('active');
              other.classList.add('inactive');
              other.setAttribute('aria-checked', 'false');
              other.style.borderColor = '#cbcbcb';
              other.style.backgroundColor = '';
              var otherIcon = other.querySelector('.checkbox-selector');
              if (otherIcon) {
                otherIcon.classList.add('icon-check-empty');
                otherIcon.classList.remove('icon-check-sign');
                otherIcon.style.color = '';
                var oldCheck = otherIcon.querySelector('.restored-gift-check');
                if (oldCheck) oldCheck.remove();
              }
            }
          }
          gift.classList.toggle('active', selected);
          gift.classList.toggle('inactive', !selected);
          gift.setAttribute('aria-checked', String(selected));
          gift.style.transition = 'border-color .2s ease, background-color .2s ease';
          gift.style.borderColor = selected ? '#194a97' : '#cbcbcb';
          gift.style.backgroundColor = selected ? '#f3f7fc' : '';
          var icon = gift.querySelector('.checkbox-selector');
          if (icon) {
            icon.classList.add('icon-check-empty');
            icon.classList.remove('icon-check-sign');
            icon.style.color = selected ? '#194a97' : '';
            var check = icon.querySelector('.restored-gift-check');
            if (selected && !check) {
              check = document.createElement('span');
              check.className = 'restored-gift-check';
              check.textContent = '✓';
              check.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#194a97;font-family:Arial,sans-serif;font-size:13px;font-weight:700;line-height:1;pointer-events:none;';
              icon.style.position = 'absolute';
              icon.appendChild(check);
            } else if (!selected && check) {
              check.remove();
            }
          }
          updateGiftInCart(gift, selected);
        }, true);
        gift.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') gift.click();
        });
      })(gifts[i]);
    }
    if (serverCart && serverCart.giftId) {
      for (var selectedIndex = 0; selectedIndex < gifts.length; selectedIndex++) {
        if (gifts[selectedIndex].getAttribute('data-item-id') === serverCart.giftId) {
          gifts[selectedIndex].click();
          break;
        }
      }
    }
  }

  function initProgress() {
    var steps = document.querySelectorAll('.dot-progress-bar');
    var lines = document.querySelectorAll('.progress-line__active');
    for (var i = 0; i < steps.length; i++) {
      (function (step, stepIndex) {
        step.setAttribute('tabindex', '0');
        step.style.cursor = 'pointer';
        step.addEventListener('click', function () {
          for (var s = 0; s < steps.length; s++) {
            var active = s <= stepIndex;
            steps[s].classList.toggle('dot-progress-bar__active', active);
            steps[s].classList.toggle('active', s === stepIndex);
            var icon = steps[s].querySelector('.container-icon-progress-bar');
            if (icon) icon.style.transition = 'background-color .3s ease, transform .25s ease';
          }
          for (var l = 0; l < lines.length; l++) {
            lines[l].style.transition = 'width .35s ease';
            lines[l].style.width = l < stepIndex ? '100%' : '0%';
          }
        }, true);
      })(steps[i], i);
    }
  }

  async function init() {
    await applyStoredCartQuantity();
    initCheckoutQuantity();
    initCoupon();
    initCarousel();
    initAddons();
    initShipping();
    initGifts();
    initProgress();
    initCartAdvance();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
