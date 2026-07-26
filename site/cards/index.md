---
title: Cards
---

Every card here is something a spirit can carry for you — some are common
enough to find on your first day out, others are the kind of thing a whole
village will have heard about by the time you're carrying one.

<div class="card-filters">
  <select id="filter-rarity">
    <option value="">All rarities</option>
    <option value="common">Common</option>
    <option value="uncommon">Uncommon</option>
    <option value="rare">Rare</option>
    <option value="epic">Epic</option>
    <option value="legendary">Legendary</option>
  </select>

  <select id="filter-type">
    <option value="">All types</option>
    <option value="active">Active</option>
    <option value="passive">Passive</option>
  </select>
</div>

<div class="card-grid" id="card-grid">
{% for card in site.data.cards %}
  {% include card-widget.html card=card %}
{% endfor %}
</div>

<p id="card-empty" class="card-widget__flavor" style="display:none;">
  Nothing matches that combination yet — check back as the collection grows.
</p>

<script>
(function () {
  var raritySel = document.getElementById('filter-rarity');
  var typeSel   = document.getElementById('filter-type');
  var cards     = Array.prototype.slice.call(document.querySelectorAll('#card-grid .card-widget'));
  var empty     = document.getElementById('card-empty');

  function applyFilter() {
    var rarity = raritySel.value;
    var type   = typeSel.value;
    var visible = 0;

    cards.forEach(function (card) {
      var matchesRarity = !rarity || card.dataset.rarity === rarity;
      var matchesType   = !type || card.dataset.type === type;
      var show = matchesRarity && matchesType;
      card.classList.toggle('is-hidden', !show);
      if (show) visible++;
    });

    empty.style.display = visible === 0 ? 'block' : 'none';
  }

  raritySel.addEventListener('change', applyFilter);
  typeSel.addEventListener('change', applyFilter);
})();
</script>
