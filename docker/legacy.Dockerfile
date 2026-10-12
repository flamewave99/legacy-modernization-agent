# Builds and runs the untouched legacy app from ./legacy (build context).
# Lives outside legacy/ so the vendored upstream code stays byte-identical.

# Stage 1: build the WAR with the Java version the upstream pom targets.
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src
COPY pom.xml .
# Cache ~/.m2 across builds so dependency downloads only happen once.
RUN --mount=type=cache,target=/root/.m2 mvn -q -B dependency:go-offline || true
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -q -B -DskipTests package

# Stage 2: deploy on Tomcat 11 (Servlet 6.1, required by Spring Framework 7).
FROM tomcat:11.0-jdk17-temurin
RUN rm -rf /usr/local/tomcat/webapps/*
# ROOT.war serves the app at "/" so URLs match `mvnw jetty:run-war`.
COPY --from=build /src/target/*.war /usr/local/tomcat/webapps/ROOT.war
EXPOSE 8080
