UUID         = claude-usage@langya466.github.com
INSTALL_DIR  = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SCHEMA_XML   = schemas/org.gnome.shell.extensions.claude-usage.gschema.xml
SOURCES      = metadata.json extension.js prefs.js
LIB_SOURCES  = lib/locale.js
DOCS         = README.md README.zh-CN.md LICENSE

.PHONY: all schemas install uninstall enable disable reload zip clean

all: schemas

schemas: schemas/gschemas.compiled

schemas/gschemas.compiled: $(SCHEMA_XML)
	glib-compile-schemas schemas

install: all
	mkdir -p "$(INSTALL_DIR)/lib" "$(INSTALL_DIR)/schemas"
	cp $(SOURCES) $(DOCS) "$(INSTALL_DIR)/"
	cp $(LIB_SOURCES) "$(INSTALL_DIR)/lib/"
	cp $(SCHEMA_XML) schemas/gschemas.compiled "$(INSTALL_DIR)/schemas/"
	@echo "Installed to $(INSTALL_DIR)"
	@echo "Reload GNOME Shell (logout/login, or Alt+F2 -> r on X11), then:"
	@echo "    gnome-extensions enable $(UUID)"

uninstall:
	rm -rf "$(INSTALL_DIR)"

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

zip: all
	rm -f $(UUID).zip
	zip -r $(UUID).zip $(SOURCES) $(DOCS) lib schemas

clean:
	rm -f schemas/gschemas.compiled $(UUID).zip
