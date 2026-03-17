PROJECT_NAME=1time
BINARIES_DIRECTORY=bin
FRONTEND_DIRECTORY=frontend
LDFLAGS = "-w -s"

.PHONY: clean vet frontend_build build

clean:
	rm -rf ${BINARIES_DIRECTORY}

vet:
	go vet ./...

frontend_build:
	cd ${FRONTEND_DIRECTORY} && npm ci && npm run build

build: clean frontend_build
	mkdir -p ${BINARIES_DIRECTORY}
	go build -ldflags ${LDFLAGS} -o ${BINARIES_DIRECTORY}/${PROJECT_NAME}
