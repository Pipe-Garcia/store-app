# 🛍️ Bazar Backend API - Spring Boot

This is a **RESTful API built with Spring Boot** for managing the sales system of a local bazaar. It allows the handling of **products, clients, and sales**, including advanced queries such as top-selling product, low-stock products, and highest sale.

> ⚙️ The goal is to apply clean architecture, DTO usage, validations, `@ManyToMany` relationships via a join entity, custom queries, and industry-standard backend development practices.

---

## 📁 Project Structure
```bash
    📦 bazar
    ├── 📂 controllers → REST endpoints
    ├── 📂 dto → Data Transfer Objects (grouped by entity)
    ├── 📂 models → JPA entity classes
    ├── 📂 repositories → JPA Repositories with custom queries
    ├── 📂 services
    │ ├── interfaces → Service layer contracts
    │ └── impl → Business logic implementations
    ├── 📜 application.properties
    ├── 📜 BazarApplication.java
```

---

## 🔧 Tech Stack

- Java 17 ☕
- Spring Boot 3.5.0
- Spring Data JPA
- MySQL
- Lombok
- Jakarta Validation
- Maven
- IntelliJ IDEA
- Postman (for testing)

---

## 🧩 Data Model

### 📦 `Product`
- `Long idProduct`
- `String name`
- `String brand`
- `Double price`
- `Double quantityAvailable`

### 👤 `Client`
- `Long idClient`
- `String name`
- `String surname`
- `String dni`

### 🧾 `Sale`
- `Long idSale`
- `LocalDate dateSale`
- `Double total`
- `Client client`
- `List<ProductSale>`

### 🔄 `ProductSale` *(Join entity for Sale–Product)*
- `Long idProductSale`
- `Double quantity`
- `Double priceUni`
- `Product product`
- `Sale sale`

---

## 🔄 Entity Relationships

- A `Client` can have many `Sale`s
- A `Sale` belongs to one `Client`
- A `Sale` can have many `Product`s and vice versa → **Many-to-Many** via `ProductSale`

---

## 🔍 Features

### 📦 Products
- `GET /products`: Get all products
- `GET /products/{id}`: Get product by ID
- `POST /products`: Create a new product
- `PUT /products`: Edit a product
- `DELETE /products/{id}`: Delete a product
- `GET /products/stock-alert`: Get products with stock < 5
- `GET /products/most-expensive`: Get the most expensive product

### 👤 Clients
- `GET /clients`: Get all clients
- `GET /clients/{id}`: Get client by ID
- `POST /clients`: Create a client
- `PUT /clients`: Edit client
- `DELETE /clients/{id}`: Delete client

### 🧾 Sales
- `GET /sales`: Get all sales
- `GET /sales/{id}`: Get sale by ID
- `POST /sales`: Create a sale
- `PUT /sales`: Edit sale
- `DELETE /sales/{id}`: Delete sale
- `GET /sales/summary/{date}`: Sales summary for a given date
- `GET /sales/highest`: Get the highest value sale

### 📋 Sale Details
- `GET /sale-details`: Get all sale-product entries
- `GET /sale-details/{id}`: Get one sale-product entry by ID
- `GET /sale-details/product-most-sold`: Get the most sold product

---

## ✅ Data Validation

Input validation is handled using Jakarta annotations like:

```java
  @NotBlank(message = "Name cannot be blank")
  @Size(min = 2, max = 40)
```
Applied to DTOs such as ClientCreateDTO, ProductCreateDTO, and more.

---

### 🚀 How to Run

1. Clone the repo:

  ```bash
    git clone https://github.com/Pipe-Garcia/bazar-springboot-api.git
```

2. Configure your MySQL database (application.properties)

```properties
   spring.datasource.url=${DB_URL}
   spring.datasource.username=${DB_USER}
   spring.datasource.password=${DB_PASSWORD}
   spring.jpa.hibernate.ddl-auto=update    
```
3. Run the app with:

  ```bash
   mvn clean install
   mvn spring-boot:run
```

4. Open in your browser:

```arduino
    http://localhost:8080
```

Use Postman or any REST client to test the API.

---

### 💡 Future Enhancements
 - ✅ Full CRUD for all entities

 - ✅ Advanced queries (top-selling product, low stock alert, etc.)

 - Add Swagger/OpenAPI documentation

 - Add unit and integration tests

 - Dockerize for production

 - Deploy to Render / Railway / Fly.io

---

### 📬 Contact

If you'd like to collaborate or provide feedback, feel free to reach out:

 - 📧 <a href="pipeg1069@gmail.com" target="_blank">pipeg1069@gmail.com</a>
 - 💼 <a href="https://www.linkedin.com/in/felipe-garc%C3%ADa-dev/" target="_blank">LinkedIn</a>
 - 🐙 <a href="https://github.com/Pipe-Garcia" target="_blank">GitHub</a>

---

### ✨ Extra Notes
This app was built as a hands-on Spring Boot practice project, simulating a real-world sales system with DTO architecture, validation, and layered design.

---

### 🧑‍🎓 Author
- Developed by Felipe Garcia.
