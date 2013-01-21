# Simple makefile is simple. See README.md.

INSTALL_DIR ?= /opt/local/share/node

.PHONY: test install

test:
	for f in `ls ./test/test-*.js` ; do \
		node $$f ; \
	done

install:
	install -m 755 -d $(INSTALL_DIR)
	install -m 444 lib/webworker.js lib/webworker-util.js \
		lib/webworker-child.js $(INSTALL_DIR)
