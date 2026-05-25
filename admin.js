(function () {
  const cfg = window.NANA_CONFIG || {};
  const ready = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && !cfg.supabaseUrl.includes("SEU-PROJETO") && window.supabase);
  const db = ready ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const el = (selector) => document.querySelector(selector);
  const els = (selector) => Array.from(document.querySelectorAll(selector));

  const state = {
    categories: [],
    products: []
  };

  function date(value) {
    return value ? new Date(value).toLocaleString("pt-BR") : "";
  }

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function parseSizes(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseUrls(value) {
    return String(value || "")
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function uniqueUrls(urls) {
    return Array.from(new Set(urls.filter(Boolean)));
  }

  function productImages(product) {
    const urls = Array.isArray(product.image_urls) ? product.image_urls : [];
    return uniqueUrls([...urls, product.image_url]).slice(0, 5);
  }

  function renderProductMediaPreview(urls = []) {
    const target = el("#product-media-preview");
    target.innerHTML = urls.length
      ? urls.map((url, index) => `
        <div class="media-preview-card">
          ${index === 0 ? `<span class="image-main-label">Principal</span>` : ""}
          <img src="${escapeHTML(url)}" alt="Foto cadastrada do produto ${index + 1}">
          <div class="image-order-actions">
            <button type="button" data-move-image="${index}" data-move-direction="-1" ${index === 0 ? "disabled" : ""}>←</button>
            <button type="button" data-move-image="${index}" data-move-direction="1" ${index === urls.length - 1 ? "disabled" : ""}>→</button>
          </div>
          <button type="button" data-remove-image="${escapeHTML(url)}">Remover</button>
        </div>
      `).join("")
      : "";

    target.querySelectorAll("[data-move-image]").forEach((button) => {
      button.addEventListener("click", () => moveProductImage(Number(button.dataset.moveImage), Number(button.dataset.moveDirection)));
    });

    target.querySelectorAll("[data-remove-image]").forEach((button) => {
      button.addEventListener("click", () => removeProductImage(button.dataset.removeImage));
    });
  }

  function currentImageUrls() {
    return parseUrls(field(el("#product-form"), "image_urls").value);
  }

  function setImageUrls(urls) {
    const nextUrls = uniqueUrls(urls).slice(0, 5);
    field(el("#product-form"), "image_urls").value = nextUrls.join("\n");
    renderProductMediaPreview(nextUrls);
  }

  function removeProductImage(url) {
    const nextUrls = currentImageUrls().filter((item) => item !== url);
    setImageUrls(nextUrls);
    el("#product-status").textContent = "Imagem removida. Clique em salvar para confirmar a alteração.";
  }

  function moveProductImage(index, direction) {
    const urls = currentImageUrls();
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= urls.length) return;
    [urls[index], urls[nextIndex]] = [urls[nextIndex], urls[index]];
    setImageUrls(urls);
    el("#product-status").textContent = "Ordem das imagens atualizada. Clique em salvar para confirmar a alteração.";
  }

  function validateProductImage(file) {
    if (!file || !file.size) return Promise.resolve();
    const maxSize = 1024 * 1024;
    if (file.size > maxSize) {
      return Promise.reject(new Error("A imagem precisa ter até 1 MB."));
    }

    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        const ratio = image.width / image.height;
        const expectedRatio = 4 / 5;
        const tolerance = 0.025;

        if (Math.abs(ratio - expectedRatio) > tolerance) {
          reject(new Error("A imagem precisa estar na proporção 4:5. Exemplo recomendado: 1080 x 1350 px."));
          return;
        }

        resolve();
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível ler a imagem escolhida."));
      };
      image.src = url;
    });
  }

  function field(form, name) {
    return form.querySelector(`[name="${name}"]`);
  }

  function productSizes(product) {
    return (product.product_variations || [])
      .filter((variation) => variation.active !== false)
      .map((variation) => variation.size)
      .filter(Boolean)
      .sort();
  }

  function productCategoryName(product) {
    const linkedCategories = (product.product_categories || [])
      .map((item) => item.categories?.name)
      .filter(Boolean);
    if (linkedCategories.length) return linkedCategories.join(", ");
    if (product.primary_category?.name) return product.primary_category.name;
    if (Array.isArray(product.categories)) return product.categories[0]?.name || "Sem categoria";
    return product.categories?.name || "Sem categoria";
  }

  function requireConfig() {
    if (db) return true;
    el("#login-status").textContent = "Configure o arquivo config.js com os dados do Supabase.";
    return false;
  }

  function showAdmin() {
    el("#login-section").classList.add("hidden");
    el("#admin-section").classList.remove("hidden");
    loadAll();
  }

  async function loadAll() {
    await loadCategories();
    await Promise.all([loadOrders(), loadLeads(), loadProducts()]);
  }

  async function loadCategories() {
    const target = el("#product-category");
    const { data, error } = await db.from("categories").select("id, name").eq("active", true).order("sort_order").order("name");
    state.categories = error ? [] : data;

    if (!target) return;
    target.innerHTML = state.categories.length
      ? state.categories.map((category) => `<option value="${category.id}">${escapeHTML(category.name)}</option>`).join("")
      : `<option value="">Cadastre categorias no Supabase</option>`;
    renderCategoryPicker();
  }

  function selectedCategoryIds() {
    return Array.from(el("#product-category").selectedOptions).map((option) => option.value).filter(Boolean);
  }

  function productCategoryIds(product) {
    const linkedIds = (product.product_categories || [])
      .map((item) => item.category_id || item.categories?.id)
      .filter(Boolean);
    return uniqueUrls([...linkedIds, product.category_id]);
  }

  function setSelectedCategories(ids = []) {
    const selected = new Set(ids.filter(Boolean));
    Array.from(el("#product-category").options).forEach((option) => {
      option.selected = selected.has(option.value);
    });
    renderCategoryPicker();
  }

  function renderCategoryPicker() {
    const tags = el("#category-picker-tags");
    const menu = el("#category-picker-menu");
    const select = el("#product-category");
    if (!tags || !menu || !select) return;

    const selected = selectedCategoryIds();
    const selectedSet = new Set(selected);
    tags.innerHTML = selected.length
      ? selected.map((id) => {
        const category = state.categories.find((item) => item.id === id);
        return category ? `
          <span class="category-chip">
            ${escapeHTML(category.name)}
            <button type="button" data-remove-category="${escapeHTML(id)}" aria-label="Remover ${escapeHTML(category.name)}">×</button>
          </span>
        ` : "";
      }).join("")
      : `<span class="category-placeholder">Escolha uma ou mais categorias</span>`;

    menu.innerHTML = state.categories.map((category) => `
      <button type="button" class="${selectedSet.has(category.id) ? "is-selected" : ""}" data-toggle-category="${escapeHTML(category.id)}">
        <span>${escapeHTML(category.name)}</span>
        <strong>${selectedSet.has(category.id) ? "✓" : ""}</strong>
      </button>
    `).join("");
  }

  function toggleCategory(categoryId) {
    const option = Array.from(el("#product-category").options).find((item) => item.value === categoryId);
    if (!option) return;
    option.selected = !option.selected;
    renderCategoryPicker();
  }

  function closeCategoryPicker() {
    const menu = el("#category-picker-menu");
    const toggle = el("#category-picker-toggle");
    if (!menu || !toggle) return;
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }

  function bindCategoryPicker() {
    const toggle = el("#category-picker-toggle");
    const menu = el("#category-picker-menu");
    if (!toggle || !menu) return;

    toggle.addEventListener("click", () => {
      menu.hidden = !menu.hidden;
      toggle.setAttribute("aria-expanded", String(!menu.hidden));
    });

    el("#category-picker").addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-remove-category]");
      const toggleButton = event.target.closest("[data-toggle-category]");

      if (removeButton) {
        event.stopPropagation();
        const option = Array.from(el("#product-category").options).find((item) => item.value === removeButton.dataset.removeCategory);
        if (option) option.selected = false;
        renderCategoryPicker();
        return;
      }

      if (toggleButton) {
        toggleCategory(toggleButton.dataset.toggleCategory);
      }
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest("#category-picker")) closeCategoryPicker();
    });
  }

  async function loadOrders() {
    const target = el("#orders-table");
    const { data, error } = await db.from("orders").select("*").order("created_at", { ascending: false }).limit(50);
    target.innerHTML = error ? `<tr><td colspan="5">Não foi possível carregar pedidos.</td></tr>` : data.map((row) => `
      <tr>
        <td><strong>${escapeHTML(row.customer_name)}</strong><br>${escapeHTML(row.customer_phone)}</td>
        <td>${escapeHTML(row.customer_type)}</td>
        <td>${money.format(Number(row.total_estimated || 0))}</td>
        <td>${escapeHTML(row.status)}</td>
        <td>${date(row.created_at)}</td>
      </tr>
    `).join("");
  }

  async function loadLeads() {
    const target = el("#leads-table");
    const { data, error } = await db.from("leads").select("*").order("created_at", { ascending: false }).limit(80);
    target.innerHTML = error ? `<tr><td colspan="5">Não foi possível carregar leads.</td></tr>` : data.map((row) => `
      <tr>
        <td>${escapeHTML(row.name)}</td>
        <td>${escapeHTML(row.phone)}</td>
        <td>${escapeHTML(row.interest)}</td>
        <td>${escapeHTML(row.status)}</td>
        <td>${date(row.created_at)}</td>
      </tr>
    `).join("");
  }

  async function loadProducts() {
    const target = el("#products-table");
    let mediaFieldsReady = true;
    let { data, error } = await db
      .from("products")
      .select("id, category_id, name, slug, sku, description, price, image_url, image_urls, video_url, featured, active, primary_category:categories!products_category_id_fkey(id, name), product_categories(category_id, categories!product_categories_category_id_fkey(id, name)), product_variations(size, active)")
      .order("name");

    if (error && (String(error.message || "").includes("image_urls") || String(error.message || "").includes("product_categories"))) {
      mediaFieldsReady = false;
      const fallback = await db
        .from("products")
        .select("id, category_id, name, slug, sku, description, price, image_url, featured, active, primary_category:categories!products_category_id_fkey(id, name), product_variations(size, active)")
        .order("name");
      data = fallback.data;
      error = fallback.error;
    }

    state.products = error ? [] : data;

    target.innerHTML = error ? `<tr><td colspan="6">Não foi possível carregar produtos.</td></tr>` : state.products.map((row) => `
      <tr>
        <td>${productImages(row)[0] ? `<img class="admin-table-image" src="${escapeHTML(productImages(row)[0])}" alt="${escapeHTML(row.name)}">` : ""}</td>
        <td><strong>${escapeHTML(row.name)}</strong><br>${escapeHTML(row.sku || "")}</td>
        <td>${escapeHTML(productCategoryName(row))}</td>
        <td>${money.format(Number(row.price || 0))}</td>
        <td>${row.active ? "Sim" : "Não"}</td>
        <td>
          <div class="table-actions">
            <button type="button" class="small-action" data-edit-product="${row.id}">Editar</button>
            <button type="button" class="small-action danger" data-delete-product="${row.id}">Excluir</button>
          </div>
        </td>
      </tr>
    `).join("");

    el("#product-status").textContent = mediaFieldsReady
      ? el("#product-status").textContent
      : "Produtos carregados. Para usar 5 imagens e vídeo, rode o SQL supabase-product-media-setup.sql no Supabase.";
  }

  async function uploadProductImages(files, slug) {
    const selectedFiles = Array.from(files || []).filter((file) => file.size);
    if (!selectedFiles.length) return [];
    if (selectedFiles.length > 5) throw new Error("Escolha no máximo 5 imagens por produto.");

    await Promise.all(selectedFiles.map(validateProductImage));
    const cleanSlug = slug || `produto-${Date.now()}`;

    return Promise.all(selectedFiles.map(async (file, index) => {
      const fileExtension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${cleanSlug}-${Date.now()}-${index + 1}.${fileExtension}`;
      const { error } = await db.storage.from("product-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false
      });
      if (error) throw error;
      const { data } = db.storage.from("product-images").getPublicUrl(path);
      return data.publicUrl;
    }));
  }

  function resetProductForm(message = "") {
    const form = el("#product-form");
    form.reset();
    field(form, "id").value = "";
    field(form, "active").checked = true;
    el("#product-form-title").textContent = "Novo produto";
    el("#product-submit").textContent = "Salvar produto";
    el("#product-status").textContent = message;
    field(form, "slug").placeholder = "Gerado automaticamente se ficar vazio";
    renderProductMediaPreview();
    setSelectedCategories();
    closeCategoryPicker();
  }

  function refreshPreviewFromTextarea() {
    renderProductMediaPreview(currentImageUrls());
  }

  function openProductModal() {
    el("#product-modal").classList.add("is-open");
    el("#product-modal").setAttribute("aria-hidden", "false");
    field(el("#product-form"), "name").focus();
  }

  function closeProductModal() {
    el("#product-modal").classList.remove("is-open");
    el("#product-modal").setAttribute("aria-hidden", "true");
  }

  function openNewProductModal() {
    resetProductForm();
    openProductModal();
  }

  function editProduct(productId) {
    const product = state.products.find((item) => String(item.id) === String(productId));
    if (!product) {
      el("#product-status").textContent = "Não foi possível encontrar esse produto na lista. Atualize a página e tente novamente.";
      return;
    }

    const form = el("#product-form");
    field(form, "id").value = product.id;
    field(form, "name").value = product.name || "";
    field(form, "slug").value = product.slug || "";
    field(form, "sku").value = product.sku || "";
    setSelectedCategories(productCategoryIds(product));
    field(form, "price").value = product.price || "";
    field(form, "sizes").value = productSizes(product).join(", ");
    field(form, "image_urls").value = productImages(product).join("\n");
    field(form, "video_url").value = product.video_url || "";
    field(form, "description").value = product.description || "";
    field(form, "featured").checked = Boolean(product.featured);
    field(form, "active").checked = product.active !== false;

    el("#product-form-title").textContent = "Editar produto";
    el("#product-submit").textContent = "Salvar alterações";
    el("#cancel-product-edit").classList.remove("hidden");
    el("#product-status").textContent = "Editando produto existente.";
    renderProductMediaPreview(currentImageUrls());
    openProductModal();
  }

  async function deleteProduct(productId) {
    const product = state.products.find((item) => String(item.id) === String(productId));
    if (!product) return;
    const confirmed = window.confirm(`Excluir o produto "${product.name}"? Essa ação remove o produto do catálogo.`);
    if (!confirmed) return;

    const status = el("#product-status");
    status.textContent = "Excluindo produto...";

    const { error } = await db.from("products").delete().eq("id", productId);
    if (error) {
      status.textContent = "Não foi possível excluir o produto. Verifique as permissões.";
      return;
    }

    if (field(el("#product-form"), "id").value === productId) resetProductForm();
    status.textContent = "Produto excluído.";
    closeProductModal();
    loadProducts();
  }

  function bindProductTableActions() {
    el("#products-table").addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-product]");
      const deleteButton = event.target.closest("[data-delete-product]");

      if (editButton) {
        editProduct(editButton.dataset.editProduct);
        return;
      }

      if (deleteButton) {
        deleteProduct(deleteButton.dataset.deleteProduct);
      }
    });
  }

  function bindTabs() {
    els("[data-admin-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        els("[data-admin-tab]").forEach((item) => item.classList.remove("is-active"));
        els(".admin-tab").forEach((item) => item.classList.add("hidden"));
        button.classList.add("is-active");
        el(`#${button.dataset.adminTab}-tab`).classList.remove("hidden");
        el("#admin-title").textContent = button.textContent;
      });
    });
  }

  el("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireConfig()) return;
    const status = el("#login-status");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    status.textContent = "Entrando...";
    const { error } = await db.auth.signInWithPassword(data);
    if (error) {
      status.textContent = "E-mail ou senha inválidos.";
      return;
    }
    showAdmin();
  });

  el("#logout-button").addEventListener("click", async () => {
    await db.auth.signOut();
    location.reload();
  });

  el("#product-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = el("#product-status");
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    const productId = data.id || null;
    const slug = slugify(data.slug || data.name);
    const sizes = parseSizes(data.sizes);
    const categoryIds = selectedCategoryIds();

    status.textContent = productId ? "Salvando alterações..." : "Salvando...";

    if (!state.categories.length) {
      status.textContent = "Cadastre pelo menos uma categoria antes de salvar produtos.";
      return;
    }

    if (!categoryIds.length) {
      status.textContent = "Escolha pelo menos uma categoria para o produto.";
      return;
    }

    const existingUrls = parseUrls(data.image_urls);
    let imageUrls = existingUrls;
    try {
      const uploadedUrls = await uploadProductImages(formData.getAll("image_files"), slug);
      imageUrls = uniqueUrls([...existingUrls, ...uploadedUrls]);
    } catch (error) {
      const message = String(error.message || "");
      status.textContent = message.toLowerCase().includes("bucket not found")
        ? "O espaço de fotos ainda não foi criado no Supabase. Rode o arquivo supabase-storage-setup.sql no SQL Editor."
        : message || "Não foi possível enviar a foto. Verifique se o bucket product-images existe no Supabase.";
      return;
    }

    if (imageUrls.length > 5) {
      status.textContent = "Cada produto pode ter no máximo 5 imagens.";
      return;
    }

    const payload = {
      category_id: categoryIds[0],
      name: data.name,
      slug,
      sku: data.sku || null,
      price: Number(data.price),
      image_url: imageUrls[0] || null,
      description: data.description || null,
      featured: Boolean(data.featured),
      active: Boolean(data.active)
    };

    if (state.products.some((product) => "image_urls" in product || "video_url" in product)) {
      payload.image_urls = imageUrls;
      payload.video_url = data.video_url || null;
    }

    const query = productId
      ? db.from("products").update(payload).eq("id", productId).select("id").single()
      : db.from("products").insert(payload).select("id").single();

    const { data: product, error } = await query;

    if (error) {
      status.textContent = "Não foi possível salvar. Verifique o slug e as permissões.";
      return;
    }

    const savedProductId = productId || product.id;
    await db.from("product_categories").delete().eq("product_id", savedProductId);
    const categoryRows = categoryIds.map((categoryId) => ({ product_id: savedProductId, category_id: categoryId }));
    const { error: categoryError } = await db.from("product_categories").insert(categoryRows);
    if (categoryError) {
      status.textContent = "Produto salvo, mas nÃ£o foi possÃ­vel atualizar as categorias. Rode o SQL de mÃºltiplas categorias no Supabase.";
      loadProducts();
      return;
    }

    const { error: deleteVariationsError } = await db.from("product_variations").delete().eq("product_id", savedProductId);
    if (deleteVariationsError) {
      status.textContent = "Produto salvo, mas não foi possível atualizar os tamanhos.";
      loadProducts();
      return;
    }

    if (sizes.length) {
      const rows = sizes.map((size) => ({ product_id: savedProductId, size, active: true }));
      const { error: variationError } = await db.from("product_variations").insert(rows);
      if (variationError) {
        status.textContent = "Produto salvo, mas não foi possível salvar os tamanhos.";
        loadProducts();
        return;
      }
    }

    resetProductForm(productId ? "Produto atualizado." : "Produto salvo.");
    closeProductModal();
    loadProducts();
  });

  el("#product-form [name='name']").addEventListener("input", (event) => {
    const slugInput = el("#product-form [name='slug']");
    if (!slugInput.value) slugInput.placeholder = slugify(event.target.value) || "Gerado automaticamente se ficar vazio";
  });

  el("#product-form [name='image_urls']").addEventListener("input", refreshPreviewFromTextarea);

  el("#product-form").addEventListener("reset", () => {
    setTimeout(() => {
      el("#product-form [name='slug']").placeholder = "Gerado automaticamente se ficar vazio";
    }, 0);
  });

  el("#cancel-product-edit").addEventListener("click", () => {
    resetProductForm("Edição cancelada.");
    closeProductModal();
  });

  el("#open-product-modal").addEventListener("click", openNewProductModal);

  els("[data-close-product-modal]").forEach((node) => {
    node.addEventListener("click", () => {
      resetProductForm();
      closeProductModal();
    });
  });

  bindTabs();
  bindProductTableActions();
  bindCategoryPicker();
  if (db) {
    db.auth.getSession().then(({ data }) => {
      if (data.session) showAdmin();
    });
  } else {
    requireConfig();
  }
})();
