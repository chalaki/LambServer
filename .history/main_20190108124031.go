//
// REST
// ====
// This example demonstrates a HTTP REST web service with some fixture data.
// Follow along the example and patterns.
//
// Also check routes.json for the generated docs from passing the -routes flag
//
// Boot the server:
// ----------------
// $ go run main.go
//
// Client requests:
// ----------------
// $ curl http://localhost:3333/
// root.
//
// $ curl http://localhost:3333/articles
// [{"id":"1","title":"Hi"},{"id":"2","title":"sup"}]
//
// $ curl http://localhost:3333/articles/1
// {"id":"1","title":"Hi"}
//
// $ curl -X DELETE http://localhost:3333/articles/1
// {"id":"1","title":"Hi"}
//
// $ curl http://localhost:3333/articles/1
// "Not Found"
//
// $ curl -X POST -d '{"id":"will-be-omitted","title":"awesomeness"}' http://localhost:3333/articles
// {"id":"97","title":"awesomeness"}
//
// $ curl http://localhost:3333/articles/97
// {"id":"97","title":"awesomeness"}
//
// $ curl http://localhost:3333/articles
// [{"id":"2","title":"sup"},{"id":"97","title":"awesomeness"}]
//
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/go-chi/chi"
	"github.com/go-chi/chi/middleware"
	"github.com/go-chi/docgen"
	"github.com/go-chi/render"
	"github.com/go-redis/redis"
)

var routes = flag.Bool("routes", false, "Generate router documentation")
var redisPort = 30379         // 6379
var nodeip = "35.226.248.125" //'192.168.99.100';
var redisDns = nodeip         //'10.0.3.3'
var redis_key = ""
var worker_dns = nodeip
var workerPlatform = "node"
var userid = "sund"
var fName = "myfunc"

func check(e error) {
	if e != nil {
		panic(e)
	}
}

func main() {
	flag.Parse()

	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.URLFormat)
	r.Use(render.SetContentType(render.ContentTypeJSON))

	//var logger = log
	log.Println("main.go started")
	var workerPlatform = "node"
	var userid = "sund"
	var functionName = "myfunc"

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {

		log.Println("lambserver GET\n...................................")
		var origindexfilecont string
		var workerFolder = "./worker/" + workerPlatform + "/" + userid + "/" + functionName + "/"
		var indexfile = workerFolder + "index.js"

		if _, err := os.Stat(indexfile); os.IsNotExist(err) {
			workerFolder = "./worker/" + workerPlatform + "/template/"
			indexfile = workerFolder + "index.js"

			if _, err := os.Stat(indexfile); !os.IsNotExist(err) {
				ba, err := ioutil.ReadFile(indexfile)
				origindexfilecont = string(ba)
				check(err)
				// log.Println(string(origindexfilecont))
			} else {
				_ = origindexfilecont
			}
		} else {
			ba, err := ioutil.ReadFile(indexfile)
			origindexfilecont = string(ba)
			check(err)
		}

		log.Println(origindexfilecont)
		f(w, r)
		w.Write([]byte(origindexfilecont))
	})

	r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("pong"))
	})

	r.Get("/panic", func(w http.ResponseWriter, r *http.Request) {
		panic("test")
	})

	// RESTy routes for "articles" resource
	r.Route("/articles", func(r chi.Router) {
		r.With(paginate).Get("/", ListArticles)
		r.Post("/", CreateArticle)       // POST /articles
		r.Get("/search", SearchArticles) // GET /articles/search

		r.Route("/{articleID}", func(r chi.Router) {
			r.Use(ArticleCtx)            // Load the *Article on the request context
			r.Get("/", GetArticle)       // GET /articles/123
			r.Put("/", UpdateArticle)    // PUT /articles/123
			r.Delete("/", DeleteArticle) // DELETE /articles/123
		})

		// GET /articles/whats-up
		r.With(ArticleCtx).Get("/{articleSlug:[a-z-]+}", GetArticle)
	})

	// Mount the admin sub-router, which btw is the same as:
	// r.Route("/admin", func(r chi.Router) { admin routes here })
	r.Mount("/admin", adminRouter())

	// Passing -routes to the program will generate docs for the above
	// router definition. See the `routes.json` file in this folder for
	// the output.
	if *routes {
		// fmt.Println(docgen.JSONRoutesDoc(r))
		fmt.Println(docgen.MarkdownRoutesDoc(r, docgen.MarkdownOpts{
			ProjectPath: "github.com/go-chi/chi",
			Intro:       "Welcome to the chi/_examples/rest generated docs.",
		}))
		return
	}

	http.ListenAndServe(":3333", r)
}

func ListArticles(w http.ResponseWriter, r *http.Request) {
	err := render.RenderList(w, r, NewArticleListResponse(articles))
	if err != nil {
		render.Render(w, r, ErrRender(err))
		return
	}
}

// ArticleCtx middleware is used to load an Article object from
// the URL parameters passed through as the request. In case
// the Article could not be found, we stop here and return a 404.
func ArticleCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var article *Article
		var err error

		if articleID := chi.URLParam(r, "articleID"); articleID != "" {
			article, err = dbGetArticle(articleID)
		} else if articleSlug := chi.URLParam(r, "articleSlug"); articleSlug != "" {
			article, err = dbGetArticleBySlug(articleSlug)
		} else {
			render.Render(w, r, ErrNotFound)
			return
		}
		if err != nil {
			render.Render(w, r, ErrNotFound)
			return
		}

		ctx := context.WithValue(r.Context(), "article", article)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// SearchArticles searches the Articles data for a matching article.
// It's just a stub, but you get the idea.
func SearchArticles(w http.ResponseWriter, r *http.Request) {
	render.RenderList(w, r, NewArticleListResponse(articles))
}

//CreateArticle persists the posted Article and returns itback to the client as an acknowledgement.
func CreateArticle(w http.ResponseWriter, r *http.Request) {
	data := &ArticleRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, ErrInvalidRequest(err))
		return
	}

	article := data.Article
	dbNewArticle(article)

	render.Status(r, http.StatusCreated)
	render.Render(w, r, NewArticleResponse(article))
}

// GetArticle returns the specific Article. You'll notice it just
// fetches the Article right off the context, as its understood that
// if we made it this far, the Article must be on the context. In case
// its not due to a bug, then it will panic, and our Recoverer will save us.
func GetArticle(w http.ResponseWriter, r *http.Request) {
	// Assume if we've reach this far, we can access the article
	// context because this handler is a child of the ArticleCtx
	// middleware. The worst case, the recoverer middleware will save us.
	article := r.Context().Value("article").(*Article)

	if err := render.Render(w, r, NewArticleResponse(article)); err != nil {
		render.Render(w, r, ErrRender(err))
		return
	}
}

// UpdateArticle updates an existing Article in our persistent store.
func UpdateArticle(w http.ResponseWriter, r *http.Request) {
	article := r.Context().Value("article").(*Article)

	data := &ArticleRequest{Article: article}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, ErrInvalidRequest(err))
		return
	}
	article = data.Article
	dbUpdateArticle(article.ID, article)

	render.Render(w, r, NewArticleResponse(article))
}

// DeleteArticle removes an existing Article from our persistent store.
func DeleteArticle(w http.ResponseWriter, r *http.Request) {
	var err error

	// Assume if we've reach this far, we can access the article
	// context because this handler is a child of the ArticleCtx
	// middleware. The worst case, the recoverer middleware will save us.
	article := r.Context().Value("article").(*Article)

	article, err = dbRemoveArticle(article.ID)
	if err != nil {
		render.Render(w, r, ErrInvalidRequest(err))
		return
	}

	render.Render(w, r, NewArticleResponse(article))
}

// A completely separate router for administrator routes
func adminRouter() chi.Router {
	r := chi.NewRouter()
	r.Use(AdminOnly)
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("admin: index"))
	})
	r.Get("/accounts", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("admin: list accounts.."))
	})
	r.Get("/users/{userId}", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(fmt.Sprintf("admin: view user id %v", chi.URLParam(r, "userId"))))
	})
	return r
}

// AdminOnly middleware restricts access to just administrators.
func AdminOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		isAdmin, ok := r.Context().Value("acl.admin").(bool)
		if !ok || !isAdmin {
			http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// paginate is a stub, but very possible to implement middleware logic
// to handle the request params for handling a paginated request.
func paginate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// just a stub.. some ideas are to look at URL query params for something like
		// the page number, or the limit, and send a query cursor down the chain
		next.ServeHTTP(w, r)
	})
}

// This is entirely optional, but I wanted to demonstrate how you could easily
// add your own logic to the render.Respond method.
func init() {
	render.Respond = func(w http.ResponseWriter, r *http.Request, v interface{}) {
		if err, ok := v.(error); ok {

			// We set a default error status response code if one hasn't been set.
			if _, ok := r.Context().Value(render.StatusCtxKey).(int); !ok {
				w.WriteHeader(400)
			}

			// We log the error
			fmt.Printf("Logging err: %s\n", err.Error())

			// We change the response to not reveal the actual error message,
			// instead we can transform the message something more friendly or mapped
			// to some code / language, etc.
			render.DefaultResponder(w, r, render.M{"status": "error"})
			return
		}

		render.DefaultResponder(w, r, v)
	}
}

//--
// Request and Response payloads for the REST api.
//
// The payloads embed the data model objects an
//
// In a real-world project, it would make sense to put these payloads
// in another file, or another sub-package.
//--

type UserPayload struct {
	*User
	Role string `json:"role"`
}

func NewUserPayloadResponse(user *User) *UserPayload {
	return &UserPayload{User: user}
}

// Bind on UserPayload will run after the unmarshalling is complete, its
// a good time to focus some post-processing after a decoding.
func (u *UserPayload) Bind(r *http.Request) error {
	return nil
}

func (u *UserPayload) Render(w http.ResponseWriter, r *http.Request) error {
	u.Role = "collaborator"
	return nil
}

// ArticleRequest is the request payload for Article data model.
//
// NOTE: It's good practice to have well defined request and response payloads
// so you can manage the specific inputs and outputs for clients, and also gives
// you the opportunity to transform data on input or output, for example
// on request, we'd like to protect certain fields and on output perhaps
// we'd like to include a computed field based on other values that aren't
// in the data model. Also, check out this awesome blog post on struct composition:
// http://attilaolah.eu/2014/09/10/json-and-struct-composition-in-go/
type ArticleRequest struct {
	*Article

	User *UserPayload `json:"user,omitempty"`

	ProtectedID string `json:"id"` // override 'id' json to have more control
}

func (a *ArticleRequest) Bind(r *http.Request) error {
	// a.Article is nil if no Article fields are sent in the request. Return an
	// error to avoid a nil pointer dereference.
	if a.Article == nil {
		return errors.New("missing required Article fields.")
	}

	// a.User is nil if no Userpayload fields are sent in the request. In this app
	// this won't cause a panic, but checks in this Bind method may be required if
	// a.User or futher nested fields like a.User.Name are accessed elsewhere.

	// just a post-process after a decode..
	a.ProtectedID = ""                                 // unset the protected ID
	a.Article.Title = strings.ToLower(a.Article.Title) // as an example, we down-case
	return nil
}

// ArticleResponse is the response payload for the Article data model.
// See NOTE above in ArticleRequest as well.
//
// In the ArticleResponse object, first a Render() is called on itself,
// then the next field, and so on, all the way down the tree.
// Render is called in top-down order, like a http handler middleware chain.
type ArticleResponse struct {
	*Article

	User *UserPayload `json:"user,omitempty"`

	// We add an additional field to the response here.. such as this
	// elapsed computed property
	Elapsed int64 `json:"elapsed"`
}

func NewArticleResponse(article *Article) *ArticleResponse {
	resp := &ArticleResponse{Article: article}

	if resp.User == nil {
		if user, _ := dbGetUser(resp.UserID); user != nil {
			resp.User = NewUserPayloadResponse(user)
		}
	}

	return resp
}

func (rd *ArticleResponse) Render(w http.ResponseWriter, r *http.Request) error {
	// Pre-processing before a response is marshalled and sent across the wire
	rd.Elapsed = 10
	return nil
}

type ArticleListResponse []*ArticleResponse

func NewArticleListResponse(articles []*Article) []render.Renderer {
	list := []render.Renderer{}
	for _, article := range articles {
		list = append(list, NewArticleResponse(article))
	}
	return list
}

// NOTE: as a thought, the request and response payloads for an Article could be the
// same payload type, perhaps will do an example with it as well.
// type ArticlePayload struct {
//   *Article
// }

//--
// Error response payloads & renderers
//--

// ErrResponse renderer type for handling all sorts of errors.
//
// In the best case scenario, the excellent github.com/pkg/errors package
// helps reveal information on the error, setting it on Err, and in the Render()
// method, using it to set the application-specific error code in AppCode.
type ErrResponse struct {
	Err            error `json:"-"` // low-level runtime error
	HTTPStatusCode int   `json:"-"` // http response status code

	StatusText string `json:"status"`          // user-level status message
	AppCode    int64  `json:"code,omitempty"`  // application-specific error code
	ErrorText  string `json:"error,omitempty"` // application-level error message, for debugging
}

func (e *ErrResponse) Render(w http.ResponseWriter, r *http.Request) error {
	render.Status(r, e.HTTPStatusCode)
	return nil
}

func ErrInvalidRequest(err error) render.Renderer {
	return &ErrResponse{
		Err:            err,
		HTTPStatusCode: 400,
		StatusText:     "Invalid request.",
		ErrorText:      err.Error(),
	}
}

func ErrRender(err error) render.Renderer {
	return &ErrResponse{
		Err:            err,
		HTTPStatusCode: 422,
		StatusText:     "Error rendering response.",
		ErrorText:      err.Error(),
	}
}

var ErrNotFound = &ErrResponse{HTTPStatusCode: 404, StatusText: "Resource not found."}

//--
// Data model objects and persistence mocks:
//--

// User data model
type User struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

// Article data model. I suggest looking at https://upper.io for an easy
// and powerful data persistence adapter.
type Article struct {
	ID     string `json:"id"`
	UserID int64  `json:"user_id"` // the author
	Title  string `json:"title"`
	Slug   string `json:"slug"`
}

// Article fixture data
var articles = []*Article{
	{ID: "1", UserID: 100, Title: "Hi", Slug: "hi"},
	{ID: "2", UserID: 200, Title: "sup", Slug: "sup"},
	{ID: "3", UserID: 300, Title: "alo", Slug: "alo"},
	{ID: "4", UserID: 400, Title: "bonjour", Slug: "bonjour"},
	{ID: "5", UserID: 500, Title: "whats up", Slug: "whats-up"},
}

// User fixture data
var users = []*User{
	{ID: 100, Name: "Peter"},
	{ID: 200, Name: "Julia"},
}

func dbNewArticle(article *Article) (string, error) {
	article.ID = fmt.Sprintf("%d", rand.Intn(100)+10)
	articles = append(articles, article)
	return article.ID, nil
}

func dbGetArticle(id string) (*Article, error) {
	for _, a := range articles {
		if a.ID == id {
			return a, nil
		}
	}
	return nil, errors.New("article not found.")
}

func dbGetArticleBySlug(slug string) (*Article, error) {
	for _, a := range articles {
		if a.Slug == slug {
			return a, nil
		}
	}
	return nil, errors.New("article not found.")
}

func dbUpdateArticle(id string, article *Article) (*Article, error) {
	for i, a := range articles {
		if a.ID == id {
			articles[i] = article
			return article, nil
		}
	}
	return nil, errors.New("article not found.")
}

func dbRemoveArticle(id string) (*Article, error) {
	for i, a := range articles {
		if a.ID == id {
			articles = append((articles)[:i], (articles)[i+1:]...)
			return a, nil
		}
	}
	return nil, errors.New("article not found.")
}

func dbGetUser(id int64) (*User, error) {
	for _, u := range users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, errors.New("user not found.")
}

//func f(indexfile string, request struct) {
func f(response http.ResponseWriter, request *http.Request) {

	log.Println("...................................")
	log.Println("lambserver rcvd POST")
	var workerFolder = "./worker/" + workerPlatform + "/" + userid + "/" + fName + "/"
	string indexfile = workerFolder + "index.js"

	var startTime = time.Now()
	userid = "sund"       //request.body.userid
	workerPlatform = "go" //request.body.worker_platform
	fName = "myfunc"      // request.body.fName
	var origindexfilecont = ""
	if _, err := os.Stat(indexfile); os.IsNotExist(err) {
		workerFolder = "./worker/" + workerPlatform + "/template/"
		indexfile = workerFolder + "index.js"

		if _, err := os.Stat(indexfile); !os.IsNotExist(err) {
			ba, err := ioutil.ReadFile(indexfile)
			origindexfilecont = string(ba)
			check(err)
			// log.Println(string(origindexfilecont))
		} else {
			_ = origindexfilecont
		}
	} else {
		ba, err := ioutil.ReadFile(indexfile)
		origindexfilecont = string(ba)
		check(err)
	}

	workerFolder = "./worker/" + workerPlatform + "/" + userid + "/" + fName + "/"
	var workerTemplateFolder = "./worker/" + workerPlatform + "/template/"
	indexfile = workerFolder + "index.js"
	var redisKey = userid + workerPlatform + fName + "_k8"

	redisClient := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	//redis_client.get(redis_key, function (error, result) {
	val, err := redisClient.Get("key").Result()
	if err != nil {
		panic(err)
	}

	//XXX	if err || val == "" {
	// if val == "" {
	// 	var workerSvcExtPort = 34348                         //(Math.floor(Math.random() * (2767)) + 30000).toString()
	// 	var workerDeplName = userid + workerPlatform + fName // + worker_svc_ext_port
	// 	redisClient.Set(redisKey,
	// 		json.Marshal({
	// 			deploymentName:      workerDeplName,
	// 			worker_svc_ext_port: workerSvcExtPort}),
	// 		redis.print)
	// } else {
	// 	uenv = JSON.parse(result)
	// 	workerDeplName = uenv.deployment_name
	// 	workerSvcExtPort = uenv.worker_svc_ext_port
	// 	if !workerSvcExtPort {
	// 		workerSvcExtPort = 34347 //(Math.floor(Math.random() * (2767)) + 30000).toString()
	// 	}
	// }

	var funcChanged = origindexfilecont != request.body.code.trim()
	logger.info("Did function change? " + funcChanged)
	var docker_running = false
	//try {
	var kubectl_is_worker_running = "kubectl get pod -l app=" + worker_depl_name + " -o jsonpath=\"{.items[0].metadata.name}\""
	log.Println(kubectl_is_worker_running)
	execSync(kubectl_is_worker_running)
	docker_running = true
	logger.info(worker_depl_name + " worker container already running")
	//}
	//catch {
	log.Println(worker_depl_name + " worker container not running")
	docker_running = false
	//}
	var pod_getname = "$(kubectl get pod -l app=" + worker_depl_name + " -o jsonpath=\"{.items[0].metadata.name}\")"

	if funcChanged || !docker_running {
		var old_comspec = process.env.comspec
		//if (process.platform === "win32") process.env.comspec = "bash"
		// set config
		// var config = { userid: userid, worker_platform: worker_platform, fName: fName }
		// execSync("echo \"" + JSON.stringify(config) + "\" > " + worker_template_folder + "worker.config")
		//try {
		var workerFolder_parent = "./worker/" + worker_platform + "/" + userid + "/"

		err := os.Stat(workerFolder_parent)
		if os.IsNotExist(err) {
			exec.Command("mkdir " + workerFolder_parent)
		}
		//			if (!fs.existsSync(workerFolder_parent)) { exec.Command("mkdir " + workerFolder_parent)}

		err := os.Stat(workerFolder)
		if os.IsNotExist(err) {
			exec.Command("mkdir " + workerFolder)
		}
		//if (!fs.existsSync(workerFolder)) { exec.Command("mkdir " + workerFolder)}
		//}
		//catch  { }

		exec.Command("cp -r " + worker_template_folder + "*  " + workerFolder)
		//process.env.comspec = old_comspec

		ba, err := ioutil.WriteFile(indexfile, request.body.code)
		//fs.writeFileSync(indexfile, request.body.code)
		log.println(indexfile + " saved.")

		// build run new image
		var prev_depl_name = worker_depl_name
		//var prev_docker_image = prev_deployment_name + "_img"

		//worker_ext_port = (Math.floor(Math.random() * (10000)) + 30000).toString()
		//worker_depl_name = userid + worker_platform + fName//+ worker_ext_port
		//docker_image = 'sundarigari/' + deployment_name

		//var docker_build_cmd = 'docker build -t ' + docker_image + ' ' + workerFolder
		//var docker_push_cmd = 'docker push ' + docker_image
		//var docker_run_cmd = 'docker run -d --name ' + docker_name + ' -t -p 0.0.0.0:' + worker_ext_port + ':' + worker_int_port.toString() + '/tcp  ' + docker_image
		data, err := ioutil.ReadFile(workerFolder + "deploy_worker.yml")
		//var data = fs.readFileSync(workerFolder + "deploy_worker.yml", "utf8")

		//XXXX var result = data.replace(/nodeworker/g, worker_depl_name)
		data, err := ioutil.WriteFile(workerFolder+"deploy_worker2.yml", result)
		//fs.writeFileSync(workerFolder + "deploy_worker2.yml", result, "utf8")

		data, err := ioutil.ReadFile(workerFolder + "service_worker.yml")
		//data = fs.readFileSync(workerFolder + "service_worker.yml", "utf8")
		//XXXX result = data.replace(/nodeworker/g, worker_depl_name).replace(/30000/g, worker_svc_ext_port)

		data, err := ioutil.WriteFile(workerFolder+"service_worker2.yml", result)
		//fs.writeFileSync(workerFolder + "service_worker2.yml", result, "utf8")

		var deployment_create_cmd = "kubectl apply -f  " + workerFolder + "deploy_worker2.yml" // todo replace worker with docker_image
		var service_create_cmd = "kubectl apply -f " + workerFolder + "service_worker2.yml"
		//XXXX redis_client.set(redis_key, JSON.stringify({ deployment_name: worker_depl_name, worker_svc_ext_port: worker_svc_ext_port }), redis.print)

		log.Println(deployment_create_cmd)
		exec.Command(deployment_create_cmd)

		//if (`${stdout}` != "") logger.info(`${stdout}`) if (`${stderr}` != "") logger.error(`${stderr}`)

		//execSync(pod_getname)
		//var podname = pod_getname// fs.readFileSync(workerFolder + ".podfile", "utf8")
		var pod_copy_files = "kubectl cp " + indexfile + "  " + k8_namespace + "/" + pod_getname + ":/"
		var pod_restart_worker_cmd = "kubectl exec " + pod_getname + " ash ./worker.sh" // worker.sh always restarts node worker.js

		logger.info(pod_copy_files)
		exec.Command(pod_copy_files)

		//if (`${stdout}` != "") logger.info(`${stdout}`) if (`${stderr}` != "") logger.error(`${stderr}`)
		var url = "http://" + worker_dns + ":" + worker_svc_ext_port + "/"

		log.Println(service_create_cmd)
		exec.Command(service_create_cmd)

		// todo get port
		//if (`${stdout}` != "") logger.info(`${stdout}`) if (`${stderr}` != "") logger.error(`${stderr}`)
		log.Println(pod_restart_worker_cmd)
		exec.Command(pod_restart_worker_cmd)
		// todo create service and get port
		//if (`${stdout}` != "") logger.info(`${stdout}`) if (`${stderr}` != "") logger.error(`${stderr}`)
		//setTimeout(() => { postAndRender(url, request, response, pod_getname, prev_depl_name, null) }, 1000)
		postAndRender(url, request, response, pod_getname, prev_depl_name, null)
		//})
		//})
		//})
		//})
	} else {
		logger.info("function did not change and container was already running. Just calling POST on worker...")
		var pod_init_worker_cmd = "kubectl exec " + pod_getname + " ash ./worker_init.sh" // worker_init.sh starts node worker.js only if its not started already
		log.Println(pod_init_worker_cmd)
		exec.Command(pod_init_worker_cmd)
		url = "http://" + worker_dns + ":" + worker_svc_ext_port + "/"
		postAndRender(url, request, response, pod_getname, null, null)
	}
}
