(function () {
  /* ---------- payment handles ----------
     Put your handles here, without the @ or $ signs.
     Leave one blank to hide that button everywhere. */
  var VENMO_USERNAME = "wayne-gipson-3";
  var CASHAPP_CASHTAG = "waynegips";

  var LEGACY_KEY = "yge_items_v1";
  var IMPORTED_KEY = "yge_imported_v1";
  var MAX_DIM = 900;

  var list = document.getElementById("itemList");
  var status = document.getElementById("status");
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
  var currentInput = document.getElementById("currentPass");
  var currentField = document.getElementById("currentField");
  var confirmField = document.getElementById("confirmField");
  var passLabel = document.getElementById("adminPassLabel");
  var lockIntro = document.getElementById("lockIntro");
  var lockSubmitBtn = document.getElementById("lockSubmitBtn");
  var lockError = document.getElementById("lockError");
  var lockCancelBtn = document.getElementById("lockCancelBtn");
  var changePassBtn = document.getElementById("changePassBtn");

  var editingId = null;
  var editingPhoto = ""; // photo the item had when editing started
  var admin = false;
  var items = [];
  var pendingPhoto = "";
  var changingPass = false;
  var loaded = false;

  /* ---------- server calls ---------- */

  function api(path, options) {
    var opts = options || {};
    var init = { method: opts.method || "GET", credentials: "same-origin" };
    if (opts.body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(opts.body);
    }
    return fetch(path, init).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (!res.ok) {
            var err = new Error(data.error || "Something went wrong. Please try again.");
            err.status = res.status;
            throw err;
          }
          return data;
        });
    });
  }

  function say(message, kind) {
    if (!message) {
      status.hidden = true;
      status.textContent = "";
      return;
    }
    status.textContent = message;
    status.className = "status " + (kind === "ok" ? "ok" : "err");
    status.hidden = false;
  }

  function busy(on) {
    saveBtn.disabled = on;
    saveBtn.textContent = on ? "Saving…" : editingId ? "Update Item" : "Save Item";
  }

  /* ---------- helpers ---------- */

  function money(n) {
    return "$" + Number(n).toFixed(2);
  }

  function smsLink(item) {
    var body =
      "Hi Y'all Get Etched! I'm interested in the " + item.name + " (" + money(item.price) + ").";
    return "sms:+17656985522?&body=" + encodeURIComponent(body);
  }

  function payNote(item) {
    return "Y'all Get Etched - " + item.name;
  }

  function venmoLink(item) {
    return (
      "https://venmo.com/" +
      encodeURIComponent(VENMO_USERNAME) +
      "?txn=pay&amount=" +
      Number(item.price).toFixed(2) +
      "&note=" +
      encodeURIComponent(payNote(item))
    );
  }

  function cashAppLink(item) {
    return (
      "https://cash.app/$" +
      encodeURIComponent(CASHAPP_CASHTAG) +
      "/" +
      Number(item.price).toFixed(2)
    );
  }

  function payLink(kind, item) {
    var a = document.createElement("a");
    a.className = "pay-link " + (kind === "venmo" ? "pay-venmo" : "pay-cash");
    a.href = kind === "venmo" ? venmoLink(item) : cashAppLink(item);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.appendChild(payIcon());
    a.appendChild(
      document.createTextNode(kind === "venmo" ? "Pay with Venmo" : "Cash App Pay")
    );
    a.setAttribute(
      "aria-label",
      (kind === "venmo" ? "Pay with Venmo" : "Pay with Cash App") +
        " for " +
        item.name +
        ", " +
        money(item.price)
    );
    return a;
  }

  function payIcon() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "2");
    rect.setAttribute("y", "5");
    rect.setAttribute("width", "20");
    rect.setAttribute("height", "14");
    rect.setAttribute("rx", "2");
    var line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", "M2 10h20");
    svg.appendChild(rect);
    svg.appendChild(line);
    return svg;
  }

  /* Shrink an image before it ever leaves the browser. */
  function readPhoto(file, done) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
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

  /* ---------- rendering ---------- */

  function render() {
    list.textContent = "";

    if (!loaded) {
      var loading = document.createElement("p");
      loading.className = "loading";
      loading.textContent = "Loading items…";
      list.appendChild(loading);
      return;
    }

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
      card.className = "item" + (item.sold ? " is-sold" : "");

      if (item.photo) {
        var top = document.createElement("div");
        top.className = "item-top";
        var photo = document.createElement("img");
        photo.className = "item-photo";
        photo.src = item.photo;
        photo.alt = item.name;
        photo.loading = "lazy";
        top.appendChild(photo);
        if (item.sold) {
          var badge = document.createElement("span");
          badge.className = "sold-badge";
          badge.textContent = "SOLD";
          top.appendChild(badge);
        }
        card.appendChild(top);
      }

      var h3 = document.createElement("h3");
      h3.textContent = item.name;
      card.appendChild(h3);

      var price = document.createElement("span");
      price.className = "price";
      price.textContent = money(item.price);
      card.appendChild(price);

      if (item.sold && !item.photo) {
        var note = document.createElement("p");
        note.className = "sold-note";
        note.textContent = "SOLD";
        card.appendChild(note);
      }

      if (item.desc) {
        var desc = document.createElement("p");
        desc.className = "desc";
        desc.textContent = item.desc;
        card.appendChild(desc);
      }

      var actions = document.createElement("div");
      actions.className = "item-actions";

      if (admin) {
        actions.appendChild(
          button("btn-sm", "Edit", function () {
            startEdit(item.id);
          })
        );
        actions.appendChild(
          button("btn-sm", item.sold ? "Mark Available" : "Mark Sold", function () {
            toggleSold(item);
          })
        );
        actions.appendChild(
          button("btn-sm danger", "Remove", function () {
            removeItem(item);
          })
        );
      } else if (!item.sold) {
        var buy = document.createElement("a");
        buy.className = "buy-link";
        buy.href = smsLink(item);
        buy.textContent = "Text to Buy";
        actions.appendChild(buy);

        if (VENMO_USERNAME) actions.appendChild(payLink("venmo", item));
        if (CASHAPP_CASHTAG) actions.appendChild(payLink("cashapp", item));

        if (VENMO_USERNAME || CASHAPP_CASHTAG) {
          var payHint = document.createElement("p");
          payHint.className = "pay-note";
          payHint.textContent =
            "Paying by app? Text us after so we can set this one aside for you.";
          actions.appendChild(payHint);
        }
      }

      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function button(className, label, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = className;
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function syncAdminUI() {
    adminToggle.textContent = admin ? "Lock Items" : "Manage Items";
    adminToggle.setAttribute("aria-pressed", admin ? "true" : "false");
    showFormBtn.hidden = !admin;
    changePassBtn.hidden = !admin;
    adminNote.hidden = !admin;
    if (!admin) closeForm();
  }

  /* ---------- data ---------- */

  function loadItems() {
    return api("/api/items")
      .then(function (data) {
        items = data.items || [];
        loaded = true;
        say("");
        render();
      })
      .catch(function (err) {
        loaded = true;
        items = [];
        say(err.message, "err");
        render();
      });
  }

  function toggleSold(item) {
    api("/api/items/" + item.id, { method: "PATCH", body: { sold: !item.sold } })
      .then(function (data) {
        items = items.map(function (i) {
          return i.id === data.item.id ? data.item : i;
        });
        render();
      })
      .catch(handleWriteError);
  }

  function removeItem(item) {
    if (!window.confirm('Remove "' + item.name + '" from the shop?')) return;
    api("/api/items/" + item.id, { method: "DELETE" })
      .then(function () {
        items = items.filter(function (i) {
          return i.id !== item.id;
        });
        if (editingId === item.id) closeForm();
        say("");
        render();
      })
      .catch(handleWriteError);
  }

  function handleWriteError(err) {
    say(err.message, "err");
    if (err.status === 401) {
      admin = false;
      syncAdminUI();
      render();
    }
  }

  /* ---------- lock / password ---------- */

  function openLock(forChange) {
    changingPass = forChange === true;
    currentField.hidden = !changingPass;
    confirmField.hidden = !changingPass;
    if (changingPass) {
      lockIntro.textContent = "Enter your current password, then pick a new one.";
      passLabel.textContent = "New password";
      passInput.setAttribute("autocomplete", "new-password");
      passInput.placeholder = "At least 8 characters";
      lockSubmitBtn.textContent = "Save Password";
    } else {
      lockIntro.textContent = "Enter your manager password.";
      passLabel.textContent = "Password";
      passInput.setAttribute("autocomplete", "current-password");
      passInput.placeholder = "Enter password";
      lockSubmitBtn.textContent = "Unlock";
    }
    lockError.hidden = true;
    lockForm.classList.add("open");
    currentInput.value = "";
    passInput.value = "";
    pass2Input.value = "";
    (changingPass ? currentInput : passInput).focus();
  }

  function closeLock() {
    lockForm.classList.remove("open");
    lockForm.reset();
    lockError.hidden = true;
    changingPass = false;
  }

  function failLock(message) {
    lockError.textContent = message;
    lockError.hidden = false;
    passInput.value = "";
    pass2Input.value = "";
    passInput.focus();
  }

  /* ---------- add / edit form ---------- */

  function openForm() {
    form.classList.add("open");
    nameInput.focus();
  }

  function closeForm() {
    form.classList.remove("open");
    form.reset();
    setPreview("");
    editingId = null;
    editingPhoto = "";
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Item";
  }

  function startEdit(id) {
    var item = items.filter(function (i) {
      return i.id === id;
    })[0];
    if (!item) return;
    closeForm();
    editingId = id;
    editingPhoto = item.photo || "";
    nameInput.value = item.name;
    priceInput.value = item.price;
    descInput.value = item.desc || "";
    setPreview(editingPhoto);
    saveBtn.textContent = "Update Item";
    openForm();
  }

  // Uploads the photo if it's newly chosen, then resolves to the fields
  // the API expects. Returns null when the photo should stay untouched.
  function resolvePhoto() {
    var isNew = pendingPhoto.indexOf("data:") === 0;
    if (isNew) {
      return api("/api/upload", { method: "POST", body: { dataUrl: pendingPhoto } }).then(
        function (data) {
          return { photoUrl: data.url, photoPathname: data.pathname };
        }
      );
    }
    if (editingId && pendingPhoto === editingPhoto) {
      return Promise.resolve(null); // unchanged
    }
    // cleared, or creating with no photo
    return Promise.resolve({ photoUrl: "", photoPathname: "" });
  }

  /* ---------- one-time import of browser-only items ---------- */

  function legacyItems() {
    try {
      if (localStorage.getItem(IMPORTED_KEY) === "1") return [];
      var raw = localStorage.getItem(LEGACY_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function markImported() {
    try {
      localStorage.setItem(IMPORTED_KEY, "1");
    } catch (e) {
      /* storage unavailable */
    }
  }

  function offerImport() {
    var old = legacyItems();
    if (!old.length) return;
    var msg =
      "Found " +
      old.length +
      (old.length === 1 ? " item" : " items") +
      " saved in this browser from before. Publish them to the live shop now?";
    if (!window.confirm(msg)) {
      markImported();
      return;
    }

    say("Publishing your saved items…", "ok");

    var chain = Promise.resolve();
    old.forEach(function (item) {
      chain = chain.then(function () {
        var photo = String(item.photo || "");
        var step = photo.indexOf("data:") === 0
          ? api("/api/upload", { method: "POST", body: { dataUrl: photo } })
          : Promise.resolve(null);
        return step.then(function (up) {
          return api("/api/items", {
            method: "POST",
            body: {
              name: item.name,
              price: item.price,
              desc: item.desc || "",
              photoUrl: up ? up.url : "",
              photoPathname: up ? up.pathname : "",
            },
          });
        });
      });
    });

    chain
      .then(function () {
        markImported();
        return loadItems();
      })
      .then(function () {
        say("Your saved items are now live for everyone.", "ok");
      })
      .catch(function (err) {
        say("Couldn't publish all of them: " + err.message, "err");
        loadItems();
      });
  }

  /* ---------- events ---------- */

  adminToggle.addEventListener("click", function () {
    if (admin) {
      api("/api/session", { method: "DELETE" }).catch(function () {});
      admin = false;
      closeLock();
      syncAdminUI();
      say("");
      render();
      return;
    }
    if (lockForm.classList.contains("open")) closeLock();
    else openLock(false);
  });

  lockForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var entered = passInput.value;
    lockSubmitBtn.disabled = true;

    var request;
    if (changingPass) {
      if (entered.length < 8) {
        lockSubmitBtn.disabled = false;
        failLock("Use at least 8 characters.");
        return;
      }
      if (entered !== pass2Input.value) {
        lockSubmitBtn.disabled = false;
        failLock("Those two passwords don't match.");
        return;
      }
      request = api("/api/session", {
        method: "PUT",
        body: { current: currentInput.value, next: entered },
      });
    } else {
      request = api("/api/session", { method: "POST", body: { password: entered } });
    }

    request
      .then(function () {
        var wasChange = changingPass;
        admin = true;
        closeLock();
        syncAdminUI();
        render();
        if (wasChange) say("Password updated.", "ok");
        else offerImport();
      })
      .catch(function (err) {
        failLock(err.message);
      })
      .then(function () {
        lockSubmitBtn.disabled = false;
      });
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
    if (!name || isNaN(price) || price < 0) return;

    var wasEditing = editingId;
    busy(true);
    say("");

    resolvePhoto()
      .then(function (photo) {
        var payload = { name: name, price: price, desc: desc };
        if (photo) {
          payload.photoUrl = photo.photoUrl;
          payload.photoPathname = photo.photoPathname;
        }
        if (wasEditing) {
          var current = items.filter(function (i) {
            return i.id === wasEditing;
          })[0];
          payload.sold = current ? current.sold : false;
          return api("/api/items/" + wasEditing, { method: "PATCH", body: payload });
        }
        return api("/api/items", { method: "POST", body: payload });
      })
      .then(function (data) {
        if (wasEditing) {
          items = items.map(function (i) {
            return i.id === data.item.id ? data.item : i;
          });
        } else {
          items.unshift(data.item);
        }
        closeForm();
        render();
      })
      .catch(function (err) {
        busy(false);
        handleWriteError(err);
      });
  });

  /* ---------- visitor counter ---------- */

  function showVisits(total) {
    var wrap = document.getElementById("visitCounter");
    var out = document.getElementById("visitCount");
    if (!wrap || !out) return;
    out.textContent = Number(total).toLocaleString();
    wrap.hidden = false;
  }

  // Counts this visit, then shows the running total. Stays hidden if it fails,
  // so a counter problem never distracts from the shop.
  api("/api/visits", { method: "POST" })
    .then(function (data) {
      showVisits(data.total);
    })
    .catch(function () {});

  /* ---------- start ---------- */

  render();
  api("/api/session")
    .then(function (data) {
      admin = data.authed === true;
    })
    .catch(function () {
      admin = false;
    })
    .then(function () {
      syncAdminUI();
      return loadItems();
    });
})();
