# syntax=docker/dockerfile:1

# Etapa de build
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
# Si tu proyecto usa perfiles, ajustá acá. Por ahora build estándar:
RUN mvn -q -DskipTests package

# Etapa de runtime
FROM eclipse-temurin:17-jre
WORKDIR /app

# Copia el JAR resultante (el primero que haya en /target) y lo renombra a app.jar
ARG JAR_FILE=/app/target/*.jar
COPY --from=build ${JAR_FILE} app.jar

EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
