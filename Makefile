install:
	cd v2-core && npm install
	cd v2-periphery && npm install
compile:
	cd v2-core && npm run compile
	cd v2-periphery && npm run compile

test: compile
	cd v2-core && npm run test
	cd v2-periphery && npm run test
