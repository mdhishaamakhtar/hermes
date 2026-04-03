# 🚀 Hermes Backend

> The real-time API and session engine behind Hermes.

Hermes Backend is a Spring Boot service responsible for authentication, event and quiz management, session orchestration, result aggregation, and STOMP-powered live updates.

---

## 🛠 Tech Stack

[![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.0.3-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-25-007396?style=for-the-badge&logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Spring Security](https://img.shields.io/badge/Spring_Security-JWT-6DB33F?style=for-the-badge&logo=springsecurity&logoColor=white)](https://spring.io/projects/spring-security)
[![Spring WebSocket](https://img.shields.io/badge/Spring-WebSocket-6DB33F?style=for-the-badge&logo=spring&logoColor=white)](https://docs.spring.io/spring-framework/reference/web/websocket.html)
[![Spring Data JPA](https://img.shields.io/badge/Spring_Data_JPA-Hibernate-6DB33F?style=for-the-badge&logo=spring&logoColor=white)](https://spring.io/projects/spring-data-jpa)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-STOMP-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com/)
[![Quartz](https://img.shields.io/badge/Quartz-JDBC_Scheduler-4B5563?style=for-the-badge)](https://www.quartz-scheduler.org/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-Springdoc-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)](https://springdoc.org/)

---

## ✨ Core Components

### 🔐 Auth & Ownership

- JWT-based auth for organiser flows
- Ownership checks across events, quizzes, questions, and sessions
- `/api/auth/me` for resolving the current authenticated user

### ⚡ Real-Time Session Engine

- STOMP endpoint at `/ws-hermes`
- RabbitMQ STOMP broker relay for topic fan-out
- Session lifecycle controls for lobby, start, next question, and end

### 🗂 Persistence & Scheduling

- PostgreSQL for application data
- Redis for ephemeral session support
- Quartz JDBC scheduler for time-based session jobs

### 📋 API Surface

- Auth endpoints for login, register, and current-user lookup
- CRUD endpoints for events, quizzes, and questions
- Session endpoints for host actions, join, rejoin, lobby state, and results

---

## ⚙️ Setup & Installation

### Option A: Full Docker (Recommended)

From the repository root:

```bash
docker-compose up --build
```

### Option B: Manual Development

1. Start infrastructure:

   ```bash
   docker-compose up -d postgres redis rabbitmq
   ```

2. Run the backend:

   ```bash
   cd backend
   ./mvnw spring-boot:run
   ```

The app defaults to local infrastructure on startup, so no extra config is required for local development unless you want custom ports or secrets.

---

## 🔐 Environment Variables

Hermes reads configuration from `src/main/resources/application.yaml`, with environment variables overriding defaults.

### Server

| Variable              | Default                 | Purpose                 |
| --------------------- | ----------------------- | ----------------------- |
| `SERVER_PORT`         | `8080`                  | HTTP server port        |
| `CORS_ALLOWED_ORIGIN` | `http://localhost:3000` | Allowed frontend origin |

### Database

| Variable                        | Default                                   | Purpose                   |
| ------------------------------- | ----------------------------------------- | ------------------------- |
| `SPRING_DATASOURCE_URL`         | `jdbc:postgresql://localhost:5432/hermes` | PostgreSQL connection URL |
| `SPRING_DATASOURCE_USERNAME`    | `hermes`                                  | PostgreSQL user           |
| `SPRING_DATASOURCE_PASSWORD`    | `hermes`                                  | PostgreSQL password       |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | `update`                                  | Hibernate schema strategy |

### Redis

| Variable                     | Default     | Purpose        |
| ---------------------------- | ----------- | -------------- |
| `SPRING_DATA_REDIS_HOST`     | `localhost` | Redis host     |
| `SPRING_DATA_REDIS_PORT`     | `6379`      | Redis port     |
| `SPRING_DATA_REDIS_PASSWORD` | empty       | Redis password |

### STOMP Broker Relay

| Variable                       | Default     | Purpose               |
| ------------------------------ | ----------- | --------------------- |
| `BROKER_RELAY_HOST`            | `localhost` | RabbitMQ broker host  |
| `BROKER_RELAY_PORT`            | `61613`     | STOMP relay port      |
| `BROKER_RELAY_VHOST`           | `/`         | RabbitMQ virtual host |
| `BROKER_RELAY_CLIENT_LOGIN`    | `hermes`    | Client relay user     |
| `BROKER_RELAY_CLIENT_PASSCODE` | `hermes`    | Client relay password |
| `BROKER_RELAY_SYSTEM_LOGIN`    | `hermes`    | System relay user     |
| `BROKER_RELAY_SYSTEM_PASSCODE` | `hermes`    | System relay password |

### Session Scheduling & Auth

| Variable              | Default          | Purpose                               |
| --------------------- | ---------------- | ------------------------------------- |
| `QUARTZ_AUTO_STARTUP` | `true`           | Enables Quartz scheduler              |
| `QUARTZ_SCHEMA_INIT`  | `never`          | Quartz schema initialization strategy |
| `QUARTZ_THREAD_COUNT` | `10`             | Quartz worker threads                 |
| `JWT_SECRET`          | local dev secret | JWT signing secret                    |
| `JWT_EXPIRATION_MS`   | `86400000`       | Token lifetime in milliseconds        |

---

## 📖 API Documentation

Swagger UI is available at:

`http://localhost:8080/swagger-ui.html`

---

## ✅ Development Commands

### Run Tests

```bash
cd backend
./mvnw test
```

### Build

```bash
cd backend
./mvnw clean package
```

### Format

```bash
cd backend
./mvnw spotless:apply
```

---

## 🔗 Links

- [Root Project README](../README.md)
- [Frontend Documentation](../frontend/README.md)
