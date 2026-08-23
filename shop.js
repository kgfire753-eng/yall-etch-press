(function () {
  var STORE_KEY = "yge_items_v1";
  var SESSION_KEY = "yge_admin_session";
  var PASS_KEY = "yge_admin_pass";
  var MAX_DIM = 900;

  var list = document.getElementById("itemList");
  var form = document.getElementById("itemForm");
  var nameInput = document.getElementById("itemName");
  var priceInput = document.getElementById("itemPrice");
  var descInput = document.getElementById("itemDesc");
  var photoInput = document.getElementById("itemPhoto");
  var photoPreview = document.getElementById("photoPreview");
  var clearPhotoBtn = document.getElementById("clearPhotoBtn");
  var adminToggle = document.getElementById("adminToggle");
  var showFormBtn = document.getElementById("showFormBtn");
  var cancelBtn = document.getElementById("cancelBtn");
  var saveBtn = document.getElementById("saveBtn");
  var adminNote = document.getElementById("adminNote");
  var lockForm = document.getElementById("lockForm");
  var passInput = document.getElementById("adminPass");
  var pass2Input = document.getElementById("adminPass2");
  var confirmField = document.getElementById("confirmField");
  var passLabel = document.getElementById("adminPassLabel");
  var lockIntro = document.getElementById("lockIntro");
  var lockSubmitBtn = document.getElementById("lockSubmitBtn");
  var lockError = document.getElementById("lockError");
  var lockCancelBtn = document.getElementById("lockCancelBtn");
  var changePassBtn = document.getElementById("changePassBtn");

  var editingId = null;
  var admin = false;
  var items = [];
  var pendingPhoto = "";
  var setupMode = false;

  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
      h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  function storedPass() {
    try {
      return localStorage.getItem(PASS_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function savePass(value) {
    try {
      localStorage.setItem(PASS_KEY, String(hash(value)));
      return true;
    } catch (e) {
      window.alert("Couldn't save the password — browser storage is blocked.");
      return false;
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      items = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(items)) items = [];
    } catch (e) {
      items = [];
    }
    try {
      admin = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch (e) {
      admin = false;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(items));
      return true;
    } catch (e) {
      window.alert(
        "Couldn't save — your browser storage is full. Try removing an item or using a smaller photo."
      );
      return false;
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

  /* Shrink an image file down to a data URL that fits in local storage. */
  function readPhoto(file, done) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.width;
        var h = img.height;
        var scale = Math.min(1, MAX_DIM / Math.max(w, h));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          done(canvas.toDataURL("image/jpeg", 0.72));
        } catch (e) {
          done("");
        }
      };
      img.onerror = function () {
        done("");
      };
      img.src = String(reader.result);
    };
    reader.onerror = function () {
      done("");
    };
    reader.readAsDataURL(file);
  }

  function setPreview(src) {
    pendingPhoto = src || "";
    if (pendingPhoto) {
      photoPreview.src = pendingPhoto;
      photoPreview.classList.add("show");
      clearPhotoBtn.hidden = false;
    } else {
      photoPreview.removeAttribute("src");
      photoPreview.classList.remove("show");
      clearPhotoBtn.hidden = true;
    }
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

      if (item.photo) {
        var photo = document.createElement("img");
        photo.className = "item-photo";
        photo.src = item.photo;
        photo.alt = item.name;
        photo.loading = "lazy";
        card.appendChild(photo);
      }

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
    adminToggle.textContent = admin ? "Lock Items" : "Manage Items";
    adminToggle.setAttribute("aria-pressed", admin ? "true" : "false");
    showFormBtn.hidden = !admin;
    changePassBtn.hidden = !admin;
    adminNote.hidden = !admin;
    if (!admin) closeForm();
  }

  function openLock(forceSetup) {
    setupMode = forceSetup === true || !storedPass();
    if (setupMode) {
      lockIntro.textContent = forceSetup
        ? "Pick a new manager password."
        : "First time here? Create a manager password so only you can add or edit items.";
      passLabel.textContent = "New password";
      passInput.setAttribute("autocomplete", "new-password");
      passInput.placeholder = "Create a password";
      confirmField.hidden = false;
      lockSubmitBtn.textContent = forceSetup ? "Save Password" : "Set Password";
    } else {
      lockIntro.textContent = "Enter your manager password.";
      passLabel.textContent = "Password";
      passInput.setAttribute("autocomplete", "current-password");
      passInput.placeholder = "Enter password";
      confirmField.hidden = true;
      lockSubmitBtn.textContent = "Unlock";
    }
    lockError.hidden = true;
    lockForm.classList.add("open");
    passInput.value = "";
    pass2Input.value = "";
    passInput.focus();
  }

  function closeLock() {
    lockForm.classList.remove("open");
    lockForm.reset();
    lockError.hidden = true;
    setupMode = false;
  }

  function openForm() {
    form.classList.add("open");
    nameInput.focus();
  }

  function closeForm() {
    form.classList.remove("open");
    form.reset();
    setPreview("");
    editingId = null;
    saveBtn.textContent = "Save Item";
  }

  function startEdit(id) {
    var item = items.filter(function (i) {
      return i.id === id;
    })[0];
    if (!item) return;
    closeForm();
    editingId = id;
    nameInput.value = item.name;
    priceInput.value = item.price;
    descInput.value = item.desc || "";
    setPreview(item.photo || "");
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
    if (admin) {
      admin = false;
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch (e) {
        /* storage unavailable */
      }
      closeLock();
      syncAdminUI();
      render();
      return;
    }
    if (lockForm.classList.contains("open")) closeLock();
    else openLock();
  });

  function failLock(message) {
    lockError.textContent = message;
    lockError.hidden = false;
    passInput.value = "";
    pass2Input.value = "";
    passInput.focus();
  }

  lockForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var entered = passInput.value;

    if (setupMode) {
      if (entered.length < 4) {
        failLock("Use at least 4 characters.");
        return;
      }
      if (entered !== pass2Input.value) {
        failLock("Those two passwords don't match.");
        return;
      }
      if (!savePass(entered)) return;
    } else if (String(hash(entered)) !== storedPass()) {
      failLock("Wrong password. Try again.");
      return;
    }

    admin = true;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch (e) {
      /* storage unavailable */
    }
    closeLock();
    syncAdminUI();
    render();
  });

  lockCancelBtn.addEventListener("click", closeLock);

  changePassBtn.addEventListener("click", function () {
    closeForm();
    openLock(true);
  });

  photoInput.addEventListener("change", function () {
    var file = photoInput.files && photoInput.files[0];
    if (!file) return;
    readPhoto(file, function (src) {
      if (!src) {
        window.alert("That image couldn't be read. Try a different photo.");
        photoInput.value = "";
        return;
      }
      setPreview(src);
    });
  });

  clearPhotoBtn.addEventListener("click", function () {
    photoInput.value = "";
    setPreview("");
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
    var photo = pendingPhoto;
    if (!name || isNaN(price) || price < 0) return;

    var snapshot = items.slice();

    if (editingId) {
      items = items.map(function (i) {
        return i.id === editingId
          ? { id: i.id, name: name, price: price, desc: desc, photo: photo }
          : i;
      });
    } else {
      items.push({
        id: String(Date.now()) + Math.random().toString(16).slice(2, 6),
        name: name,
        price: price,
        desc: desc,
        photo: photo,
      });
    }

    if (!save()) {
      items = snapshot;
      return;
    }
    closeForm();
    render();
  });

  load();
  syncAdminUI();
  render();
})();
