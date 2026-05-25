(function () {
  const cfg = window.NANA_CONFIG || {};
  const hasSupabase = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && !cfg.supabaseUrl.includes("SEU-PROJETO") && window.supabase);
  const db = hasSupabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  const fallbackProducts = [
    {
      id: "demo-1",
      name: "Tanga Fio Duplo Microfibra",
      category: "Tangas",
      price: 7.5,
      sku: "1015",
      sizes: ["M", "G", "GG"],
      image_url: "https://img.gopage.bio/page-8396/3966b11e-a958-45ca-991f-7d89ef01f2a8.webp",
      featured: true
    },
    {
      id: "demo-2",
      name: "Baby Doll Suede com Manga",
      category: "Linha noite",
      price: 26.9,
      sku: "BD-001",
      sizes: ["P", "M", "G", "GG"],
      image_url: "https://img.gopage.bio/page-8396/21edfa8c-99c0-4bbc-8cdf-4cd4c7474319.webp",
      featured: true
    },
    {
      id: "demo-3",
      name: "Top Virginia",
      category: "Soutiens",
      price: 16.99,
      sku: "TV-001",
      sizes: ["M", "G"],
      image_url: "https://img.gopage.bio/page-8396/191341f2-bfd0-4007-8b34-03065ddea6a7.webp",
      featured: true
    },
    {
      id: "demo-4",
      name: "Tangão Microfibra Plus",
      category: "Plus Size",
      price: 10.9,
      sku: "PLUS-001",
      sizes: ["GG", "XG", "XGG"],
      image_url: "https://img.gopage.bio/page-8396/5bdab47f-13c9-46b5-8b6d-e06f05f71b89.webp",
      featured: false
    },
    {
      id: "demo-5",
      name: "Kit com 3 Pares de Meia Cano Curto",
      category: "Meias",
      price: 15.99,
      sku: "MEIA-003",
      sizes: ["Único"],
      image_url: "https://img.gopage.bio/page-8396/cxUBFGBXv1BpsgJzLshR.jpg",
      featured: false
    },
    {
      id: "demo-6",
      name: "Cueca Box Infantil Listrada",
      category: "Masculino",
      price: 5.99,
      sku: "INF-4023",
      sizes: ["P", "M", "G"],
      image_url: "https://img.gopage.bio/page-8396/82d8401d-2935-492e-afd0-d94061494fe0.webp",
      featured: false
    }
  ];

  const state = {
    products: [],
    cart: JSON.parse(localStorage.getItem("nana-cart") || "[]"),
    activeCategory: "Todas as Categorias",
    search: ""
  };

  const categoryAliases = {
    "Todas as Categorias": ["Todas as Categorias", "Todos", "Todas", ""],
    "Calcas": ["Calcas", "Calças", "Calcinhas", "Calçolas", "Calcinha"],
    "Infantil": ["Infantil"],
    "Linha Noite": ["Linha Noite", "linha-noite", "Linha noite", "Pijama", "Baby Doll"],
    "Masculino": ["Masculino", "Cueca"],
    "Plus Size": ["Plus Size", "Plus size", "Plus"],
    "Soutiens": ["Soutiens", "Soutien", "Top"],
    "Tangas": ["Tangas", "Tanga", "Calcinhas"],
    "Meias": ["Meias", "Meia", "Kits", "Kit"]
  };

  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const el = (selector) => document.querySelector(selector);
  const els = (selector) => Array.from(document.querySelectorAll(selector));

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function normalizePhone(phone) {
    return String(phone || "").replace(/\D/g, "");
  }

  function productPrice(product) {
    return Number(product.price || product.preco || 0);
  }

  function productCategory(product) {
    if (Array.isArray(product.categories) && product.categories.length) return product.categories.join(", ");
    return product.category || product.categoria_nome || product.categories?.name || "Outros";
  }

  function productMatchesCategory(product, selectedCategory) {
    if (selectedCategory === "Todas as Categorias") return true;
    const category = productCategory(product);
    const categories = Array.isArray(product.categories) ? product.categories.join(" ") : "";
    const haystack = `${category} ${categories} ${product.name || ""} ${product.description || ""}`.toLowerCase();
    return (categoryAliases[selectedCategory] || [selectedCategory]).some((term) => haystack.includes(String(term).toLowerCase()));
  }

  function productSizes(product) {
    if (Array.isArray(product.sizes)) return product.sizes;
    if (Array.isArray(product.variations)) return product.variations.map((item) => item.size || item.tamanho).filter(Boolean);
    if (Array.isArray(product.variacoes_produto)) return product.variacoes_produto.map((item) => item.tamanho).filter(Boolean);
    return ["Único"];
  }

  function productImages(product) {
    const urls = Array.isArray(product.image_urls) ? product.image_urls : [];
    return Array.from(new Set([...urls, product.image_url, product.image].filter(Boolean))).slice(0, 5);
  }

  function filteredProducts(category = state.activeCategory, queryValue = state.search) {
    const query = String(queryValue || "").trim().toLowerCase();
    return state.products.filter((product) => {
      const sizes = productSizes(product).join(" ");
      const matchesCategory = productMatchesCategory(product, category);
      const matchesSearch = !query || `${product.name} ${productCategory(product)} ${sizes} ${product.sku || ""}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }

  function homepageProducts() {
    const products = filteredProducts();
    if (state.activeCategory !== "Todas as Categorias" || state.search) return products;
    return products.filter((product) => product.featured);
  }

  function videoEmbedUrl(url) {
    const value = String(url || "").trim();
    if (!value) return "";
    try {
      const parsed = new URL(value);
      if (parsed.hostname.includes("youtu.be")) {
        return `https://www.youtube.com/embed/${parsed.pathname.replace("/", "")}`;
      }
      if (parsed.hostname.includes("youtube.com")) {
        const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
        return id ? `https://www.youtube.com/embed/${id}` : value;
      }
      if (parsed.hostname.includes("drive.google.com")) {
        const match = value.match(/\/d\/([^/]+)/);
        return match ? `https://drive.google.com/file/d/${match[1]}/preview` : value;
      }
      return value;
    } catch (error) {
      return value;
    }
  }

  function videoAspectClass(url) {
    const value = String(url || "").toLowerCase();
    return value.includes("/shorts/") || value.includes("drive.google.com") ? "is-vertical" : "is-horizontal";
  }

  function saveCart() {
    localStorage.setItem("nana-cart", JSON.stringify(state.cart));
  }

  function buildWhatsAppUrl(message) {
    const number = normalizePhone(cfg.whatsappNumber || "5522988524928");
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function leadMessage(data) {
    return [
      `Olá, ${cfg.storeName || "Nana Moda Íntima"}! Gostaria de receber atendimento pelo WhatsApp.`,
      "",
      `Nome: ${data.name}`,
      `WhatsApp: ${data.phone}`,
      `Interesse: ${data.interest}`,
      "",
      "Aguardo o contato de uma consultora."
    ].join("\n");
  }

  function orderMessage(customer, orderId) {
    const lines = state.cart.flatMap((item) => [
      "Produto:",
      item.name,
      `Categoria: ${item.category || "Não informada"}`,
      `Tamanho: ${item.size}`,
      `Quantidade: ${item.quantity}`,
      `Valor: ${money.format(item.price * item.quantity)}`,
      ""
    ]);

    return [
      `Olá, ${cfg.storeName || "Nana Moda Íntima"}! Gostaria de fazer um pedido:`,
      "",
      ...lines,
      `Observações: ${customer.notes || "Sem observações"}`,
      "",
      `Meu nome: ${customer.name}`,
      `Meu WhatsApp: ${customer.phone}`,
      "",
      "Aguardo a confirmação de disponibilidade, cores, entrega e forma de pagamento."
    ].filter(Boolean).join("\n");
  }

  function cartTotal() {
    return state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function renderProducts() {
    const grid = el("#product-grid");
    if (!grid) return;
    const products = homepageProducts();

    grid.innerHTML = products.map((product) => {
      const sizes = productSizes(product);
      const images = productImages(product);
      const mainImage = images[0] || "";
      const imageButtons = images.length > 1 ? `
        <div class="product-thumbs" aria-label="Fotos de ${product.name}">
          ${images.map((image, index) => `
            <button type="button" class="${index === 0 ? "is-active" : ""}" data-gallery-image="${image}" data-gallery-target="${product.id}" aria-label="Ver foto ${index + 1} de ${product.name}">
              <img src="${image}" alt="">
            </button>
          `).join("")}
        </div>
      ` : "";
      const videoLink = product.video_url ? `<button class="video-link" type="button" data-open-product="${product.id}">Ver vídeo do produto</button>` : "";
      return `
        <article class="product-card" data-open-product="${product.id}">
          <img class="product-main-image" data-main-image="${product.id}" src="${mainImage}" alt="${escapeHTML(product.name)}">
          ${imageButtons}
          <div class="product-body">
            <div class="product-meta">
              <span class="tag">${escapeHTML(productCategory(product))}</span>
              <span class="price">${money.format(productPrice(product))}</span>
            </div>
            <h3>${escapeHTML(product.name)}</h3>
            ${videoLink}
            <div class="product-controls">
              <label>Tamanho
                <select aria-label="Tamanho de ${escapeHTML(product.name)}" data-size-for="${product.id}">
                  ${sizes.map((size) => `<option value="${escapeHTML(size)}">${escapeHTML(size)}</option>`).join("")}
                </select>
              </label>
              <label>Qtd.
                <input type="number" min="1" value="1" inputmode="numeric" data-qty-for="${product.id}">
              </label>
            </div>
            <button class="primary-button" data-add="${product.id}">Adicionar ao pedido</button>
          </div>
        </article>
      `;
    }).join("") || `<p class="empty">Nenhum produto encontrado.<br>Tente escolher outra categoria ou fale com a gente pelo WhatsApp.</p>`;

    grid.querySelectorAll("[data-add]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        addToCart(button.dataset.add);
      });
    });
    grid.querySelectorAll("[data-gallery-image]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const mainImage = grid.querySelector(`[data-main-image="${button.dataset.galleryTarget}"]`);
        if (mainImage) mainImage.src = button.dataset.galleryImage;
        button.parentElement.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
      });
    });
    grid.querySelectorAll("[data-open-product]").forEach((node) => {
      node.addEventListener("click", (event) => {
        event.stopPropagation();
        openProductDetail(node.dataset.openProduct);
      });
    });
  }

  function renderCart() {
    el("#cart-count").textContent = String(state.cart.reduce((sum, item) => sum + item.quantity, 0));
    el("#cart-total").textContent = money.format(cartTotal());
    const container = el("#cart-items");

    if (!state.cart.length) {
      container.innerHTML = `<p class="empty">Seu pedido ainda está vazio.</p>`;
      return;
    }

    container.innerHTML = state.cart.map((item, index) => `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}">
        <div>
          <h3>${item.name}</h3>
          <p>${item.category || "Categoria"} | Tam. ${item.size} | ${item.quantity} un. - ${money.format(item.price * item.quantity)}</p>
        </div>
        <button class="remove-button" data-remove="${index}" aria-label="Remover ${item.name}">Remover</button>
      </div>
    `).join("");

    container.querySelectorAll("[data-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        state.cart.splice(Number(button.dataset.remove), 1);
        saveCart();
        renderCart();
      });
    });
  }

  function productCardButton(product) {
    const image = productImages(product)[0] || "";
    return `
      <button class="modal-product-card" type="button" data-open-product="${product.id}">
        <img src="${image}" alt="${escapeHTML(product.name)}">
        <div>
          <span class="tag">${escapeHTML(productCategory(product))}</span>
          <h3>${escapeHTML(product.name)}</h3>
          <strong>${money.format(productPrice(product))}</strong>
        </div>
      </button>
    `;
  }

  function openCategoryModal(category) {
    state.activeCategory = category;
    els(".category-pill, .category-card").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.category === category);
    });
    renderProducts();

    const products = filteredProducts(category, state.search);
    el("#category-modal-title").textContent = category;
    el("#category-modal-grid").innerHTML = products.length
      ? products.map(productCardButton).join("")
      : `<p class="empty">Nenhum produto encontrado.<br>Tente escolher outra categoria ou fale com a gente pelo WhatsApp.</p>`;

    el("#category-modal-grid").querySelectorAll("[data-open-product]").forEach((button) => {
      button.addEventListener("click", () => openProductDetail(button.dataset.openProduct));
    });

    const modal = el("#category-modal");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeCategoryModal() {
    const modal = el("#category-modal");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function closeProductDetail() {
    const modal = el("#product-detail-modal");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    el("#product-detail-body").innerHTML = "";
  }

  function openProductDetail(productId) {
    const product = state.products.find((item) => String(item.id) === String(productId));
    if (!product) return;

    const images = productImages(product);
    const sizes = productSizes(product);
    const embedUrl = videoEmbedUrl(product.video_url);
    const body = el("#product-detail-body");

    body.innerHTML = `
      <div class="product-detail-layout">
        <div class="detail-gallery">
          <img class="detail-main-image" id="detail-main-image" src="${images[0] || ""}" alt="${escapeHTML(product.name)}">
          ${images.length > 1 ? `
            <div class="detail-thumbs">
              ${images.map((image, index) => `
                <button type="button" class="${index === 0 ? "is-active" : ""}" data-detail-image="${image}" aria-label="Ver foto ${index + 1}">
                  <img src="${image}" alt="">
                </button>
              `).join("")}
            </div>
          ` : ""}
        </div>
        <div class="detail-info">
          <span class="tag">${escapeHTML(productCategory(product))}</span>
          <h2 id="product-detail-title">${escapeHTML(product.name)}</h2>
          <div class="detail-price">${money.format(productPrice(product))}</div>
          ${product.description ? `<p class="detail-description">${escapeHTML(product.description)}</p>` : ""}
          ${embedUrl ? `
            <div class="detail-video ${videoAspectClass(product.video_url)}">
              <h3>Vídeo do produto</h3>
              <iframe src="${embedUrl}" title="Vídeo de ${escapeHTML(product.name)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
            </div>
          ` : ""}
          <div class="detail-controls">
            <label>Tamanho
              <select id="detail-size">
                ${sizes.map((size) => `<option value="${escapeHTML(size)}">${escapeHTML(size)}</option>`).join("")}
              </select>
            </label>
            <label>Qtd.
              <input id="detail-qty" type="number" min="1" value="1" inputmode="numeric">
            </label>
          </div>
          <button class="primary-button full" type="button" id="detail-add">Adicionar ao pedido</button>
        </div>
      </div>
    `;

    body.querySelectorAll("[data-detail-image]").forEach((button) => {
      button.addEventListener("click", () => {
        el("#detail-main-image").src = button.dataset.detailImage;
        button.parentElement.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
      });
    });

    el("#detail-add").addEventListener("click", () => {
      addToCart(product.id, el("#detail-size")?.value, Number(el("#detail-qty")?.value || 1));
      closeProductDetail();
    });

    const modal = el("#product-detail-modal");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function addToCart(productId, selectedSize, selectedQuantity) {
    const product = state.products.find((item) => String(item.id) === String(productId));
    const size = selectedSize || document.querySelector(`[data-size-for="${productId}"]`)?.value || productSizes(product)[0];
    const quantity = Math.max(1, Number(selectedQuantity || document.querySelector(`[data-qty-for="${productId}"]`)?.value || 1));
    const existing = state.cart.find((item) => String(item.id) === String(productId) && item.size === size);

    if (existing) {
      existing.quantity += quantity;
    } else {
      state.cart.push({
        id: product.id,
        name: product.name,
        size,
        category: productCategory(product),
        quantity,
        price: productPrice(product),
        sku: product.sku || "",
        image: productImages(product)[0] || ""
      });
    }

    saveCart();
    renderCart();
    openCart();
  }

  function openCart() {
    const panel = el("#cart-panel");
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
  }

  function closeCart() {
    const panel = el("#cart-panel");
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
  }

  async function loadProducts() {
    if (!db) {
      state.products = fallbackProducts;
      renderProducts();
      renderCart();
      return;
    }

    const { data, error } = await db
      .from("products_public")
      .select("*")
      .eq("active", true)
      .order("featured", { ascending: false })
      .order("name");

    state.products = error || !data?.length ? fallbackProducts : data.map((product) => ({
      ...product,
      sizes: product.sizes || ["Único"]
    }));
    renderProducts();
    renderCart();
  }

  async function saveLead(data) {
    if (!db) return null;
    const { data: lead, error } = await db
      .from("leads")
      .insert({
        name: data.name,
        phone: normalizePhone(data.phone),
        interest: data.interest,
        source: "site",
        status: "novo"
      })
      .select("id")
      .single();
    if (error) throw error;
    return lead;
  }

  async function saveOrder(customer) {
    if (!db) return null;
    const lead = await saveLead({ ...customer, interest: customer.customerType });
    const { data: order, error } = await db
      .from("orders")
      .insert({
        lead_id: lead?.id || null,
        customer_name: customer.name,
        customer_phone: normalizePhone(customer.phone),
        customer_city: customer.city || null,
        customer_type: customer.customerType,
        notes: customer.notes || null,
        status: "enviado_whatsapp",
        total_estimated: cartTotal()
      })
      .select("id")
      .single();

    if (error) throw error;

    const rows = state.cart.map((item) => ({
      order_id: order.id,
      product_id: String(item.id).startsWith("demo-") ? null : item.id,
      product_name: item.name,
      sku: item.sku,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.price
    }));

    const { error: itemsError } = await db.from("order_items").insert(rows);
    if (itemsError) throw itemsError;
    return order;
  }

  function bindEvents() {
    el("#open-cart").addEventListener("click", openCart);
    els("[data-close-cart]").forEach((node) => node.addEventListener("click", closeCart));
    const defaultWhatsapp = buildWhatsAppUrl(`Olá, ${cfg.storeName || "Nana Moda Íntima"}! Gostaria de atendimento.`);
    ["#floating-whatsapp", "#header-whatsapp", "#footer-whatsapp", "#promo-whatsapp", "#social-whatsapp"].forEach((selector) => {
      const link = el(selector);
      if (link) link.href = defaultWhatsapp;
    });

    els(".category-pill, .category-card").forEach((button) => {
      button.addEventListener("click", () => {
        openCategoryModal(button.dataset.category);
      });
    });

    els("[data-close-category-modal]").forEach((node) => node.addEventListener("click", closeCategoryModal));
    els("[data-close-product-detail]").forEach((node) => node.addEventListener("click", closeProductDetail));

    el("#search").addEventListener("input", (event) => {
      state.search = event.target.value;
      renderProducts();
    });

    el("#lead-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = el("#lead-status");
      const data = Object.fromEntries(new FormData(event.currentTarget));
      status.textContent = "Salvando seu contato...";
      try {
        await saveLead(data);
        status.textContent = "Contato registrado. Abrindo WhatsApp...";
        window.open(buildWhatsAppUrl(leadMessage(data)), "_blank");
        event.currentTarget.reset();
      } catch (error) {
        status.textContent = "Não foi possível salvar agora, mas vamos abrir o WhatsApp.";
        window.open(buildWhatsAppUrl(leadMessage(data)), "_blank");
      }
    });

    el("#order-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = el("#order-status");
      if (!state.cart.length) {
        status.textContent = "Adicione pelo menos um produto ao pedido.";
        return;
      }

      const customer = Object.fromEntries(new FormData(event.currentTarget));
      status.textContent = "Preparando pedido...";
      try {
        const order = await saveOrder(customer);
        window.open(buildWhatsAppUrl(orderMessage(customer, order?.id)), "_blank");
        state.cart = [];
        saveCart();
        renderCart();
        event.currentTarget.reset();
        status.textContent = "Pedido enviado para o WhatsApp.";
      } catch (error) {
        window.open(buildWhatsAppUrl(orderMessage(customer)), "_blank");
        status.textContent = "Abrimos o WhatsApp. Confira depois a conexão com o Supabase.";
      }
    });
  }

  bindEvents();
  loadProducts();
})();
