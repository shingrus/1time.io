package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

const defaultDuration = 86400  // keep for 1 day (matches the client + protocol default)
const maxDuration = 86400 * 30 // keep for 1 month
//const randKeyLen = 12

//const secretMessageFieldName = "secretMessage"
//const secretKeyFieldName = "secretKey"
//const secretMessageMaxLen = 64 * 1024

var _, DEBUG = os.LookupEnv("DEBUG")

var version = "dev"

const shutdownTimeout = 15 * time.Minute

type options struct {
	showVersion bool
	listenAddr  string
}

func parseOptions(args []string, envListenAddr string) (options, error) {
	fs := flag.NewFlagSet("1time-api", flag.ContinueOnError)
	showVersion := fs.Bool("version", false, "print the version and exit")
	listen := fs.String("listen", "", "listen address (overrides LISTEN_ADDR)")
	if err := fs.Parse(args); err != nil {
		return options{}, err
	}

	addr := *listen
	if addr == "" {
		addr = envListenAddr
	}
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	return options{showVersion: *showVersion, listenAddr: addr}, nil
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	fmt.Fprint(w, "ok "+version)
}

func main() {
	opts, err := parseOptions(os.Args[1:], os.Getenv("LISTEN_ADDR"))
	if err != nil {
		os.Exit(2)
	}
	if opts.showVersion {
		fmt.Println(version)
		return
	}

	if fileStorageDir == "" {
		log.Printf("Env %s is not set, exiting", FILE_STORAGE_DIR_VAR)
		os.Exit(1)
	}

	appStats.Start()
	startFileJanitor()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/", apiHandler)
	mux.HandleFunc("/healthz", healthHandler)
	srv := &http.Server{Addr: opts.listenAddr, Handler: mux}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.ListenAndServe() }()

	log.Printf("1time-api %s listening on %s", version, opts.listenAddr)
	select {
	case err := <-serveErr:
		log.Fatal(err)
	case sig := <-stop:
		log.Printf("%v received, draining for up to %v", sig, shutdownTimeout)
	}

	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
	if err := appStats.FlushCounters(); err != nil {
		log.Println(err)
	}
}
