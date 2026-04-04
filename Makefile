PROJECT_NAME=1time-api
BINARIES_DIRECTORY=bin
FRONTEND_DIRECTORY=frontend
BACKEND_DIRECTORY=backend
LDFLAGS = "-w -s"

.PHONY: clean vet frontend_build build

clean:
	rm -rf ${BINARIES_DIRECTORY}

vet:
	go vet ./${BACKEND_DIRECTORY}/...

frontend_build:
	cd ${FRONTEND_DIRECTORY} && npm install && npm run build

build: clean frontend_build
	mkdir -p ${BINARIES_DIRECTORY}
	GOCACHE=/tmp/go-cache go build -ldflags ${LDFLAGS} -o ${BINARIES_DIRECTORY}/${PROJECT_NAME} ./${BACKEND_DIRECTORY}
