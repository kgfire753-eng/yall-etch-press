(function () {
  var STORE_KEY = "yge_items_v1";
  var ADMIN_KEY = "yge_admin_v1";

  var list = document.getElementById("itemList");
  var form = document.getElementById("itemForm");
  var nameInput = document.getElementById("itemName");
  var priceInput = document.getElementById("itemPrice");
  var descInput = document.getElementById("itemDesc");
  var adminToggle = document.getElementById("adminToggle");
  var showFormBtn = document.getElementById("showFormBtn");
  var cancelBtn = document.getElementById("cancelBtn");
  var saveBtn = document.getElementById("saveBtn");
  var adminNote = document.getElementById("adminNote");

  var editingId = null;
  var admin = false;
  var items = [];

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      items = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(items)) items = [];
    } catch (e) {
      items = [];
    }
    try {
      admin = localStorage.getItem(ADMIN_KEY) === "1";
    } catch (e) {
      admin = false;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(items));
    } catch (e) {
      /* storage unavailable */
    }
  }

  function money(n) {
    return "$" + Number(n).toFixed(2);
  }

  function smsLink(item) {
    var body =
      "Hi Y'all Get Etched! I'm interested in the " +
      item.name +
      " (" +
      money(item.price) +
      ").";
    return "sms:+17656985522?&body=" + encodeURIComponent(body);
  }

  function render() {
    list.textContent = "";

    if (items.length === 0) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = admin
        ? "No items yet. Use “+ Add Item” to list your first piece."
        : "Nothing listed right now — check back soon or text us for a custom order.";
      list.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      var card = document.createElement("article");
      card.className = "item";

      var h3 = document.createElement("h3");
      h3.textContent = item.name;
      card.appendChild(h3);

      var price = document.createElement("span");
      price.className = "price";
      price.textContent = money(item.price);
      card.appendChild(price);

      if (item.desc) {
        var desc = document.createElement("p");
        desc.className = "desc";
        desc.textContent = item.desc;
        card.appendChild(desc);
      }

      var actions = document.createElement("div");
      actions.className = "item-actions";

      if (admin) {
        var editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn-sm";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", function () {
          startEdit(item.id);
        });

        var delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn-sm danger";
        delBtn.textContent = "Remove";
        delBtn.setAttribute("aria-label", "Remove " + item.name);
        delBtn.addEventListener("click", function () {
          removeItem(item.id);
        });

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
      } else {
        var buy = document.createElement("a");
        buy.className = "buy-link";
        buy.href = smsLink(item);
        buy.textContent = "Text to Buy";
        actions.appendChild(buy);
      }

      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function syncAdminUI() {
    adminToggle.textContent = admin ? "Done Managing" : "Manage Items";
    adminToggle.setAttribute("aria-pressed", admin ? "true" : "false");
    showFormBtn.hidden = !admin;
    adminNote.hidden = !admin;
    if (!admin) closeForm();
  }

  function openForm() {
    form.classList.add("open");
    nameInput.focus();
  }

  function closeForm() {
    form.classList.remove("open");
    form.reset();
    editingId = null;
    saveBtn.textContent = "Save Item";
  }

  function startEdit(id) {
    var item = items.filter(function (i) {
      return i.id === id;
    })[0];
    if (!item) return;
    editingId = id;
    nameInput.value = item.name;
    priceInput.value = item.price;
    descInput.value = item.desc || "";
    saveBtn.textContent = "Update Item";
    openForm();
  }

  function removeItem(id) {
    items = items.filter(function (i) {
      return i.id !== id;
    });
    if (editingId === id) closeForm();
    save();
    render();
  }

  adminToggle.addEventListener("click", function () {
    admin = !admin;
    try {
      localStorage.setItem(ADMIN_KEY, admin ? "1" : "0");
    } catch (e) {
      /* storage unavailable */
    }
    syncAdminUI();
    render();
  });

  showFormBtn.addEventListener("click", function () {
    closeForm();
    openForm();
  });

  cancelBtn.addEventListener("click", closeForm);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = nameInput.value.trim();
    var price = parseFloat(priceInput.value);
    var desc = descInput.value.trim();
    if (!name || isNaN(price) || price < 0) return;

    if (editingId) {
      items = items.map(function (i) {
        return i.id === editingId
          ? { id: i.id, name: name, price: price, desc: desc }
          : i;
      });
    } else {
      items.push({
        id: String(Date.now()) + Math.random().toString(16).slice(2, 6),
        name: name,
        price: price,
        desc: desc,
      });
    }

    save();
    closeForm();
    render();
  });

  load();
  syncAdminUI();
  render();
})();
