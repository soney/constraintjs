all: core

core:
	mkdir -p build
	./Makefile.dryice.js

clean:
	rm -f build/cjs.js
	@@echo ""
	@@echo ""
	@@echo "Clean!"
	@@echo ""
