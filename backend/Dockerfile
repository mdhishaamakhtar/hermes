FROM eclipse-temurin:25-jdk-jammy AS builder
WORKDIR /app
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline -q
COPY src/ src/
RUN ./mvnw package -DskipTests -q

FROM eclipse-temurin:25-jre-jammy
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", \
  "-XX:MaxMetaspaceSize=128m", \
  "-XX:ReservedCodeCacheSize=64m", \
  "-XX:MaxDirectMemorySize=64m", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-jar", "app.jar"]
