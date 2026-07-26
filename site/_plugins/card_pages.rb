module Spiritbound
  # A generated /cards/[slug]/ page, built directly from one entry of
  # _data/cards.json rather than from a file on disk.
  class CardPage < Jekyll::Page
    def initialize(site, base, card)
      @site = site
      @base = base
      @dir  = File.join("cards", card["slug"])

      self.process("index.html")

      self.data = card.merge(
        "layout" => "card",
        "title"  => card["name"]
      )
      self.content = ""
    end
  end

  # Reads site.data["cards"] (synced from content/cards.json before build)
  # and emits one CardPage per entry.
  class CardPageGenerator < Jekyll::Generator
    safe true
    priority :normal

    def generate(site)
      cards = site.data["cards"]
      return unless cards.is_a?(Array)

      cards.each do |card|
        site.pages << CardPage.new(site, site.source, card)
      end
    end
  end
end
