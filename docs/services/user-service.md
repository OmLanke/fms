# User Service

## Responsibility

The User Service manages user identities, credentials, and JWT issuance. It is the authority on who a user is and whether their credentials are valid.

Responsibilities:
- User registration (with password hashing using bcrypt)
- User login (credential validation, JWT generation)
- User profile retrieval
- Publishing `user.registered` events to Kafka (triggers welcome email)

---

## Technology Stack

| Component | Technology |
|---|---|
| Runtime | JDK 21 |
| Framework | Spring Boot 3.3 |
| Language | Java |
| Database | PostgreSQL 16 |
| ORM | Spring Data JPA (Hibernate) |
| Migrations | Flyway |
| Auth | Spring Security + JJWT |
| Kafka | Spring Kafka |
| Metrics | Micrometer → Prometheus |
| Tracing | OpenTelemetry Java Agent |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | No | Register a new user |
| POST | `/login` | No | Authenticate, receive JWT |
| GET | `/me` | Yes (X-User-Id header) | Get current user profile |
| GET | `/actuator/health` | No | Spring Boot health check |
| GET | `/actuator/prometheus` | No | Prometheus metrics |

---

## Database Schema

```sql
-- V1__create_users.sql
CREATE TABLE users (
    id          VARCHAR(26) PRIMARY KEY,       -- ULID
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,          -- bcrypt hash
    role        VARCHAR(20) NOT NULL DEFAULT 'USER',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

---

## Kafka Topics

| Action | Topic | Direction |
|---|---|---|
| User registered | `ticketflow.user.registered` | Produced |

### Producer configuration

```java
@Bean
public ProducerFactory<String, Object> producerFactory() {
    Map<String, Object> props = new HashMap<>();
    props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
    props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
    props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
    props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
    props.put(ProducerConfig.ACKS_CONFIG, "all");
    return new DefaultKafkaProducerFactory<>(props);
}
```

---

## Key Business Logic

### Password hashing

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12); // cost factor 12
}
```

### JWT generation

```java
public String generateToken(User user) {
    return Jwts.builder()
        .subject(user.getId())
        .claim("name", user.getName())
        .claim("email", user.getEmail())
        .claim("role", user.getRole().name())
        .issuedAt(new Date())
        .expiration(new Date(System.currentTimeMillis() + expiryMs))
        .signWith(signingKey)
        .compact();
}
```

The gateway verifies tokens using the same `JWT_SECRET`; the User Service does not need to validate tokens on every request.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `SERVER_PORT` | Listening port | `3001` |
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL | `jdbc:postgresql://postgres:5432/ticketflow` |
| `SPRING_DATASOURCE_USERNAME` | DB username | `ticketflow` |
| `SPRING_DATASOURCE_PASSWORD` | DB password | — |
| `JWT_SECRET` | HMAC signing key | — |
| `JWT_EXPIRY_HOURS` | Token lifetime | `24` |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka broker | `kafka:9092` |
| `OTEL_EXPORTER_JAEGER_ENDPOINT` | Jaeger endpoint | `http://jaeger:14268/api/traces` |

---

## Local Development

```bash
cd services/user-service

# Run with local profile (uses localhost for DB and Kafka)
mvn spring-boot:run -Dspring-boot.run.profiles=local

# Run tests
mvn test

# Build fat JAR
mvn package -DskipTests
```

---

## Docker Build

```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY pom.xml ./
COPY src ./src
RUN ./mvnw package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 3001
ENTRYPOINT ["java", "-jar", "app.jar"]
```
