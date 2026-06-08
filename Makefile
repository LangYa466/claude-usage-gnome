UUID = claude-usage@langya466.github.com
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

FILES = metadata.json extension.js prefs.js locale.js README.md README.zh-CN.md LICENSE \
        schemas/gschemas.compiled \
        schemas/org.gnome.shell.extensions.claude-usage.gschema.xml

.PHONY: all schemas install uninstall zip clean enable disable

all: schemas

schemas: schemas/gschemas.compiled

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.claude-usage.gschema.xml
	glib-compile-schemas schemas

install: all
	mkdir -p "$(INSTALL_DIR)/schemas"
	cp metadata.json extension.js prefs.js locale.js README.md README.zh-CN.md LICENSE "$(INSTALL_DIR)/"
	cp schemas/*.xml schemas/gschemas.compiled "$(INSTALL_DIR)/schemas/"
	@echo "Installed. Reload GNOME Shell (logout/login, or Alt+F2 -> r on X11)."
	@echo "Then: gnome-extensions enable $(UUID)"

uninstall:
	rm -rf "$(INSTALL_DIR)"

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

zip: all
	rm -f $(UUID).zip
	zip -r $(UUID).zip metadata.json extension.js prefs.js locale.js README.md README.zh-CN.md LICENSE schemas/

clean:
	rm -f schemas/gschemas.compiled $(UUID).zip
