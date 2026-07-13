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
        '<td class="quantity"><span>1</span></td><td class="quantity-price"></td><td class="item-remove"><button type="button" class="restored-addon-remove" aria-label="Remover ' + addon.name.replace(/"/g, '&quot;') + '" style="border:0;background:transparent;color:#999;font-size:28px;line-height:1;cursor:pointer;padding:6px">×</button></td>';
      body.appendChild(row);
      row.querySelector('.restored-addon-remove').addEventListener('click', async function () {
        var removeButton = this;
        removeButton.disabled = true;
        try {
          await cartRequest('addon-remove', { addonId: addon.id });
          row.remove();
          var source = document.querySelector('.beon-showcase__item[data-product-sku="' + addon.id + '"]');
          var sourceButton = source && source.querySelector('.beon-button--primary');
          if (sourceButton) {
            sourceButton.classList.remove('restored-addon-added');
            sourceButton.style.background = '';
            sourceButton.setAttribute('aria-label', 'Adicionar produto ao carrinho');
          }
          await applyStoredCartQuantity();
        } catch (_) {
          removeButton.disabled = false;
        }
      });
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
    var upsell = document.querySelector('#beon-element-1735c46e-7cfe-48ef-a01d-f2812c583ff4');
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
        '<button type="submit" class="restored-identification-continue" style="grid-column:1/-1;height:52px;border:0;border-radius:100px;background:#3e7dbf;color:#fff;font-size:16px;font-weight:700;cursor:pointer;margin-top:8px">Continuar</button>' +
        '</form></section>';
    }

    var identification = holder.querySelector('.restored-identification');
    var identificationForm = holder.querySelector('.restored-identification-form');
    var deliveryStage = document.createElement('section');
    deliveryStage.className = 'restored-delivery-stage';
    deliveryStage.style.cssText = 'display:none;background:#fff;border-radius:16px;padding:24px;box-sizing:border-box;width:100%;max-width:720px;margin:0 auto';
    deliveryStage.innerHTML = '<h2 style="margin:0 0 8px;color:#194a97;font-size:24px">Entrega</h2><p style="margin:0 0 22px;color:#676767">Informe o endereço completo para receber seu pedido.</p>' +
      '<form class="restored-address-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px">' +
      '<label style="grid-column:1/-1">Nome do destinatário<input required autocomplete="name" name="recipient"></label>' +
      '<label>CEP<div style="display:flex;gap:8px;margin-top:6px"><input required inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}" maxlength="9" autocomplete="postal-code" name="cep" style="margin-top:0"><button type="button" class="restored-address-cep" style="border:0;border-radius:100px;padding:0 18px;background:#194a97;color:#fff;font-weight:700">Buscar</button></div></label>' +
      '<label>Rua<input required autocomplete="address-line1" name="street"></label>' +
      '<label>Número<input required autocomplete="address-line2" name="number"></label>' +
      '<label>Complemento<input autocomplete="address-line2" name="complement"></label>' +
      '<label>Bairro<input required name="neighborhood"></label>' +
      '<label>Cidade<input required autocomplete="address-level2" name="city"></label>' +
      '<label>Estado<input required pattern="[A-Za-z]{2}" maxlength="2" autocomplete="address-level1" name="state"></label>' +
      '<div class="restored-address-status" aria-live="polite" style="grid-column:1/-1;color:#194a97;font-weight:600"></div>' +
      '<button type="submit" style="grid-column:1/-1;height:52px;border:0;border-radius:100px;background:#3e7dbf;color:#fff;font-size:16px;font-weight:700;cursor:pointer">Continuar para pagamento</button></form>';
    holder.appendChild(deliveryStage);

    var paymentStage = document.createElement('section');
    paymentStage.className = 'restored-payment-stage';
    paymentStage.style.cssText = 'display:none;background:#fff;border-radius:16px;padding:24px;box-sizing:border-box;width:100%;max-width:720px;margin:0 auto';
    paymentStage.innerHTML = '<h2 style="margin:0 0 8px;color:#194a97;font-size:24px">Pagamento</h2><p style="margin:0 0 22px;color:#676767">Revise o pedido e pague com Pix.</p>' +
      '<div class="restored-payment-summary" style="border:1px solid #d9e5f3;border-radius:14px;padding:18px;margin-bottom:18px"></div>' +
      '<div class="restored-pix-area" style="border:1px solid #d9e5f3;border-radius:14px;padding:20px;text-align:center">' +
      '<h3 style="margin:0 0 8px;color:#194a97;font-size:19px">Pague com Pix</h3><p style="margin:0 0 18px;color:#676767">Escaneie o QR Code ou use o código copia e cola.</p>' +
      '<div class="restored-pix-qrcode" aria-live="polite" style="width:220px;min-height:220px;margin:0 auto 18px;border:1px dashed #b9cbe2;border-radius:12px;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;color:#676767">Aguardando geração do Pix</div>' +
      '<label style="display:block;text-align:left;font-weight:600;color:#424242">Pix copia e cola<div style="display:flex;gap:8px;margin-top:8px"><input class="restored-pix-code" readonly aria-label="Código Pix copia e cola" placeholder="O código aparecerá aqui após a geração" style="min-width:0;flex:1;height:46px;border:1px solid #cbcbcb;border-radius:100px;padding:0 16px;box-sizing:border-box;background:#fff"><button type="button" class="restored-pix-copy" disabled style="height:46px;border:0;border-radius:100px;padding:0 20px;background:#194a97;color:#fff;font-weight:700">Copiar</button></div></label>' +
      '<div class="restored-pix-status" aria-live="polite" style="margin-top:12px;color:#676767;font-size:13px">O Pix será disponibilizado quando a integração de pagamento gerar a cobrança.</div></div>';
    holder.appendChild(paymentStage);

    function renderPaymentSummary() {
      var cart = serverCart;
      if (!cart) return;
      var summary = paymentStage.querySelector('.restored-payment-summary');
      function cents(value) { return 'R$ ' + (value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
      function imageFrom(selector) {
        var image = document.querySelector(selector);
        return image ? image.getAttribute('src') : '';
      }
      var rows = [{
        name: cart.product.name,
        detail: cart.quantity + ' unidade(s)',
        value: cart.product.sellingPrice * cart.quantity,
        image: imageFrom('.cart-items tbody .product-item:not(.restored-addon-cart-item):not(.restored-gift-cart-item) .product-image img')
      }];
      (cart.addons || []).forEach(function (addon) {
        rows.push({
          name: addon.name,
          detail: '1 unidade',
          value: addon.sellingPrice,
          image: imageFrom('.beon-showcase__item[data-product-sku="' + addon.id + '"] .beon-showcase__item-image img')
        });
      });
      if (cart.gift) rows.push({
        name: cart.gift.name,
        detail: 'Brinde selecionado',
        value: 0,
        image: imageFrom('.available-gift-item[data-item-id="' + cart.gift.id + '"] .product-image img')
      });
      var html = '<h3 style="margin:0 0 14px;color:#194a97;font-size:19px">Resumo do pedido</h3>';
      rows.forEach(function (row) {
        html += '<div style="display:grid;grid-template-columns:64px minmax(0,1fr) auto;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #edf1f5;text-align:left">' +
          '<div style="width:64px;height:64px;border-radius:10px;background:#f4f4f4;display:flex;align-items:center;justify-content:center;overflow:hidden">' + (row.image ? '<img src="' + row.image.replace(/"/g, '&quot;') + '" alt="' + row.name.replace(/"/g, '&quot;') + '" style="display:block;max-width:100%;max-height:100%;object-fit:contain">' : '') + '</div>' +
          '<span><strong style="display:block;color:#424242;line-height:1.3">' + row.name + '</strong><small style="color:#676767">' + row.detail + '</small></span><strong style="white-space:nowrap;color:' + (row.value ? '#202020' : '#194a97') + '">' + (row.value ? cents(row.value) : 'Grátis') + '</strong></div>';
      });
      if (cart.totals.discount > 0) html += '<div style="display:flex;justify-content:space-between;padding-top:12px;color:#24704a"><span>Descontos</span><strong>- ' + cents(cart.totals.discount) + '</strong></div>';
      html += '<div style="display:flex;justify-content:space-between;align-items:end;padding-top:16px;font-size:18px"><strong>Total</strong><strong style="color:#194a97">' + cents(cart.totals.total) + ' no PIX</strong></div>';
      summary.innerHTML = html;
    }

    var qrCodeLibraryPromise = null;
    var pixRequestPromise = null;

    function loadQrCodeLibrary() {
      if (window.QRCode && window.QRCode.toDataURL) return Promise.resolve(window.QRCode);
      if (qrCodeLibraryPromise) return qrCodeLibraryPromise;
      qrCodeLibraryPromise = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
        script.onload = function () { resolve(window.QRCode); };
        script.onerror = function () { reject(new Error('Não foi possível renderizar o QR Code')); };
        document.head.appendChild(script);
      });
      return qrCodeLibraryPromise;
    }

    async function setPixPayment(data) {
      if (!data || !data.copyPaste) return;
      var qr = paymentStage.querySelector('.restored-pix-qrcode');
      var code = paymentStage.querySelector('.restored-pix-code');
      var copy = paymentStage.querySelector('.restored-pix-copy');
      code.value = data.copyPaste;
      copy.disabled = false;
      try {
        var QRCode = await loadQrCodeLibrary();
        var imageUrl = await QRCode.toDataURL(data.copyPaste, { width: 360, margin: 2, errorCorrectionLevel: 'M' });
        qr.innerHTML = '<img src="' + imageUrl + '" alt="QR Code Pix da West Pay" style="display:block;width:100%;height:auto">';
      } catch (_) {
        qr.textContent = 'Use o código Pix copia e cola abaixo.';
      }
      var expiry = data.expiresAt ? new Date(data.expiresAt).toLocaleString('pt-BR') : '';
      paymentStage.querySelector('.restored-pix-status').textContent = 'Pix gerado pela West Pay.' + (expiry ? ' Válido até ' + expiry + '.' : '');
    }
    window.creamySetPixPayment = setPixPayment;

    function generatePixPayment() {
      if (pixRequestPromise) return pixRequestPromise;
      var qr = paymentStage.querySelector('.restored-pix-qrcode');
      var status = paymentStage.querySelector('.restored-pix-status');
      qr.textContent = 'Gerando cobrança Pix...';
      status.textContent = 'Conectando com a West Pay com segurança.';
      pixRequestPromise = fetch('/api/pix', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(async function (response) {
          var data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Não foi possível gerar o Pix');
          await setPixPayment(data);
          return data;
        })
        .catch(function (error) {
          qr.textContent = 'Pix indisponível';
          status.textContent = error.message || 'Não foi possível gerar o Pix. Tente novamente.';
          pixRequestPromise = null;
          throw error;
        });
      return pixRequestPromise;
    }
    paymentStage.querySelector('.restored-pix-copy').addEventListener('click', async function () {
      var code = paymentStage.querySelector('.restored-pix-code').value;
      if (!code) return;
      await navigator.clipboard.writeText(code);
      this.textContent = 'Copiado';
    });

    var addressForm = deliveryStage.querySelector('.restored-address-form');
    var addressStatus = deliveryStage.querySelector('.restored-address-status');
    var addressInputs = addressForm.querySelectorAll('input');
    for (var addressInputIndex = 0; addressInputIndex < addressInputs.length; addressInputIndex++) {
      addressInputs[addressInputIndex].style.cssText = 'display:block;width:100%;height:46px;margin-top:6px;border:1px solid #cbcbcb;border-radius:100px;padding:0 16px;box-sizing:border-box';
    }
    addressForm.elements.cep.style.marginTop = '0';
    var savedAddress = serverCart && serverCart.shipping ? serverCart.shipping : {};
    ['recipient', 'cep', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'].forEach(function (field) {
      if (addressForm.elements[field] && savedAddress[field]) addressForm.elements[field].value = savedAddress[field];
    });

    async function lookupAddress() {
      var cep = addressForm.elements.cep.value.replace(/\D/g, '');
      if (cep.length !== 8) {
        addressStatus.textContent = 'Digite um CEP com 8 números.';
        return;
      }
      addressStatus.textContent = 'Buscando endereço...';
      try {
        var response = await fetch('/api/cep?cep=' + encodeURIComponent(cep));
        var result = await response.json();
        if (!response.ok || result.erro) throw new Error('CEP inválido');
        addressForm.elements.street.value = result.logradouro || '';
        addressForm.elements.neighborhood.value = result.bairro || '';
        addressForm.elements.city.value = result.localidade || '';
        addressForm.elements.state.value = result.uf || '';
        addressStatus.textContent = 'Endereço encontrado. Informe o número e confira os dados.';
        addressForm.elements.number.focus();
      } catch (_) {
        addressStatus.textContent = 'CEP não encontrado. Confira o número e tente novamente.';
      }
    }
    addressForm.querySelector('.restored-address-cep').addEventListener('click', lookupAddress);
    addressForm.elements.cep.addEventListener('input', function () {
      var digits = this.value.replace(/\D/g, '').slice(0, 8);
      this.value = digits.length > 5 ? digits.slice(0, 5) + '-' + digits.slice(5) : digits;
    });

    function showDeliveryStage() {
      identification.style.display = 'none';
      paymentStage.style.display = 'none';
      deliveryStage.style.display = 'block';
      var steps = document.querySelectorAll('.dot-progress-bar');
      if (steps[2]) steps[2].click();
      window.location.hash = '#/orderform/shipping';
      cartRequest('stage', { stage: 'shipping' }).catch(function () {});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showPaymentStage() {
      identification.style.display = 'none';
      deliveryStage.style.display = 'none';
      paymentStage.style.display = 'block';
      renderPaymentSummary();
      generatePixPayment().catch(function () {});
      var steps = document.querySelectorAll('.dot-progress-bar');
      if (steps[3]) steps[3].click();
      window.location.hash = '#/orderform/payment';
      cartRequest('stage', { stage: 'payment' }).catch(function () {});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    identificationForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!identificationForm.reportValidity()) return;
      var submit = identificationForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'Salvando identificação...';
      try {
        await cartRequest('profile', { profile: {
          email: identificationForm.elements.email.value,
          firstName: identificationForm.elements.firstName.value,
          lastName: identificationForm.elements.lastName.value,
          document: identificationForm.elements.document.value,
          phone: identificationForm.elements.phone.value
        } });
        showDeliveryStage();
      } catch (error) {
        window.alert(error.message || 'Não foi possível salvar a identificação.');
      } finally {
        submit.disabled = false;
        submit.textContent = 'Continuar';
      }
    });

    addressForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!addressForm.reportValidity()) return;
      var submit = addressForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'Salvando endereço...';
      try {
        var payload = {};
        ['recipient', 'cep', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'].forEach(function (field) {
          payload[field] = addressForm.elements[field].value.trim();
        });
        await cartRequest('address', { address: payload });
        showPaymentStage();
      } catch (error) {
        addressStatus.textContent = error.message || 'Não foi possível salvar o endereço.';
      } finally {
        submit.disabled = false;
        submit.textContent = 'Continuar para pagamento';
      }
    });

    advance.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      cart.classList.remove('active');
      cart.style.display = 'none';
      orderform.classList.remove('inactive', 'sf-hidden');
      orderform.classList.add('active');
      orderform.style.cssText = 'display:flex;opacity:1;position:relative;margin-left:0;width:100%';
      if (upsell) upsell.style.display = 'none';
      window.location.hash = '#/orderform/profile';
      cartRequest('stage', { stage: 'profile' }).catch(function () {});
      var steps = document.querySelectorAll('.dot-progress-bar');
      if (steps[1]) steps[1].click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, true);

    if (window.location.hash.indexOf('/profile') !== -1) advance.click();
    else if (window.location.hash.indexOf('/shipping') !== -1) {
      advance.click();
      showDeliveryStage();
    } else if (window.location.hash.indexOf('/payment') !== -1) {
      advance.click();
      showPaymentStage();
    }
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
