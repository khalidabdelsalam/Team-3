# Project Title: Microservices Based Scheduler and Webhook System

**Student Name:** [Your Name]  
**Course Name:** [Course Name]  
**Date:** 2026-04-24  

---

## 2. Introduction

**What is this project?**  
This project is a modern software system built to handle tasks behind the scenes automatically and send notifications. It consists of two main programs: a Webhook Service and a Scheduler Service.

**What problem does it solve?**  
Sometimes, a server needs to tell another external server that something happened (like a successful payment). If the other server is down, the message is lost. This project solves that problem. It securely stores the message, tries to send it, and if it fails, it schedules a "retry" to try sending it again later without blocking the main website.

**What is Microservices Architecture?**  
Instead of building one giant program that does everything (which is hard to fix if it breaks), we build small, separate programs (services). Each program does only one job perfectly. 

**Why we used this architecture?**  
If the Webhook Service crashes, the Scheduler Service will keep working safely. We can also update or fix one service without stopping the whole system. This makes our project very strong.

---

## 3. System Overview

**What are the main components?**  
1. **Webhook Service:** Sends messages to outside systems.
2. **Scheduler Service:** Manages time and triggers delayed actions.
3. **Kafka:** The post office. It carries messages between the services.
4. **MongoDB:** The memory. It saves tasks safely so nothing is forgotten.

**How the system works in general:**  
When a user does something important, the system creates an event. This event is sent to Kafka. The services listen to Kafka, pick up the event, do their assigned job, and save the final result in MongoDB.

---

## 4. Services Explanation

### Webhook Service

**What is a Webhook?**  
A Webhook is simply an automated phone call between computers. Whenever something happens in our app, our server automatically sends a quick HTTP POST message to an external URL to let them know.

**What does this service do?**  
It listens for events (like "PAYMENT_DONE") and sends the webhook data to the target external server. 

**When does it run?**  
It runs constantly in the background, listening to the Kafka message system.

**What data does it receive?**  
It receives JSON data from Kafka. This data contains the event name and the payload (like User ID and Money Amount).

**What data does it send?**  
It sends that exact payload over the internet to an external website.

### Scheduler Service

**What is Scheduler?**  
It is an automated timer. It works exactly like the alarm clock on your phone. 

**What are scheduled jobs?**  
These are tasks that you want to happen at a very specific time in the future, or tasks that need to repeat every few minutes.

**What does this service do?**  
It reads the database every few seconds to find jobs that are waiting (PENDING). If a job's time has arrived, the Scheduler picks it up and runs it.

**How it triggers jobs:**  
It uses a tool called `node-cron`. The cron checks the time. When it matches, it reads the MongoDB database. It finds the job and executes the handler logic.

---

## 5. Project Flow (Very Important)

How data moves step-by-step:

### Scenario 1: File Uploaded
1. A file is completely uploaded by a user on the main website.
2. The main server tells **Kafka**: "Hey, a File is Uploaded!".
3. The **Webhook Service**, which is a consumer listening to Kafka, receives this event.
4. The Webhook Service takes the file info and sends an automatic Webhook to an external system to say "New file is ready!".
5. Finally, the service writes "Success" into **MongoDB**.

### Scenario 2: Scheduler retries a failed job
1. Imagine the Webhook failed earlier. A job was saved in the database to retry later.
2. The **Scheduler Service** runs exactly at the scheduled minute.
3. It finds the "Retry webhook" job inside MongoDB.
4. The Scheduler is a producer. It sends an event to **Kafka** saying: "RETRY_WEBHOOK".
5. The Webhook service receives this from Kafka and attempts to send the webhook again.

---

## 6. Code Structure

Our code is very clean and divided into folders. Here is what each folder does in our Node.js services:

* **controllers:** Handles incoming requests. It is the middleman between the user and the services.
* **routes:** Defines the URL paths (like `/create-job`). It connects a URL to the right controller function.
* **services:** The brain of the app. This is where the business logic lives (how to save things, how to process data).
* **models:** Defines the database structure. It tells MongoDB what a "Job" or "JobLog" should look like.
* **config:** Settings. It holds the passwords, database URLs, and port numbers.
* **jobs:** Contains the specific handlers. It knows exactly what coding steps to run for each type of scheduled task.

---

## 7. File Connections

How the files talk to each other inside the code:

1. A user calls a URL endpoint in `routes/jobRoutes.js`.
2. The Route sends the request to `controllers/jobController.js`.
3. The Controller checks if the data is correct. Then, it calls a function sitting in `services/jobService.js`.
4. `jobService.js` performs the complex logic. It talks to the `models/Job.js` Model to securely save the data into the database.
5. Finally, `jobService.js` calls `services/kafkaService.js` to send a message to other services.

**Summary of the flow inside the code:**  
`Route` → `Controller` → `Service` → `Database (Model)` → `Kafka`.

---

## 8. Database (MongoDB)

**Why we use MongoDB?**  
MongoDB is a NoSQL database. It is very flexible and fast. Since webhooks and background jobs have all different types of data (payloads), MongoDB stores them perfectly without needing strict tables.

**Collections used:**
* **webhooks:** Stores the target URLs and the secret keys for external clients.
* **job_logs:** Saves the history of every job execution. It records exactly what time it started and if it failed or succeeded.
* **jobs:** Stores the waiting tasks.

**What is stored? Example Fields:**  
In the "jobs" collection, we store:  
* `name`: The title of the job.
* `type`: "WEBHOOK_RETRY".
* `status`: "PENDING" or "SUCCESS".
* `retries`: How many times we tried to run it (like 0, 1, 2).
* `payload`: The actual message data in JSON.

---

## 9. Kafka Explanation

**What is Kafka?**  
Kafka is a digital post office. It is a highly fast message broker.

**Why we use it:**  
If Services talk directly (API to API), and one service breaks, everything breaks. Kafka sits in the middle. If the receiving service is dead, Kafka holds the message safely until the service wakes up and reads it. 

**What is a producer and consumer?**
* **Producer:** A service that creates a message and sends it to Kafka (Example: Scheduler Service sends a trigger event).
* **Consumer:** A service that reads messages from Kafka and acts upon them (Example: Webhook Service reads the event).

**What topics are used?**  
We use a topic named `events`. A topic is like a specific mail folder. Services only read the folders they care about.

---

## 10. Docker Explanation

**What is Docker?**  
Docker is a tool that packs our code, Node.js, and all libraries into an isolated box called a "Container".

**Why we use Docker:**  
It guarantees our code will run exactly the same way on any computer in the world. It stops the "it works on my laptop but not on the server" problem.

**What is Dockerfile?**  
It is a simple text file with instructions on how to build the container box. It tells Docker: "Download Node.js, copy my code files, and install dependencies."

**What is docker-compose?**  
Because we have many containers (MongoDB container, Kafka container, Scheduler container), `docker-compose.yml` is the master plan that links them all together and starts them at the same time.

**Why it is used in microservices:**  
Microservices require multiple databases and servers. Docker allows us to run 5 different services independently on one laptop with a single command.

---

## 11. PM2 Explanation

**What is PM2?**  
PM2 is a process manager for Node.js. 

**Why we use it:**  
Normally, if a Node.js server gets an error, the server crashes and stops working forever. PM2 acts like an automatic guard. If the server crashes, PM2 restarts it instantly in milliseconds.

**Difference between PM2 and normal node run:**  
Running `node server.js` is only for testing. If it fails, you must type the command again.
Running `pm2 start ecosystem.config.js` runs it safely in the background, handles high memory usage, and never stops.

---

## 12. How to Run the Project

To run the full project, please follow these exact steps:

1. **Install dependencies:**  
   Open the terminal inside the project folder and type: `npm install`
2. **Run docker-compose:**  
   Start all databases and message brokers: `docker-compose up --build -d`
3. **Start services:**  
   The containers will automatically start the Node.js services inside them using PM2. Monitor them natively using `docker ps`.
4. **Test endpoints:**  
   Open Postman and send a GET request to `http://localhost:3002/jobs` to see the database responding perfectly.

---

## 13. Conclusion

**What we achieved:**  
We successfully built a highly scalable, fault-tolerant background processing system. We separated the time-management logic (Scheduler) from the networking logic (Webhook).

**Why this system is good:**  
It never loses data. If a third-party server goes down, our retry mechanism using MongoDB safely holds the webhook and tries again later. Because it uses Kafka, our system is extremely fast and will not freeze under heavy load.

**Future Improvements:**  
In the future, we can add a visual Dashboard using React.js so managers can easily see which Webhooks failed and manually click a button to retry them. We can also add email alerts if a job fails more than 5 times.
