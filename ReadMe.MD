# 🏪  Store Management System - Spring Boot API

This is a **RESTful API built with Spring Boot** for a comprehensive store management system, handling inventory, purchases, sales, and user authentication. It supports CRUD operations for entities like materials, suppliers, orders, deliveries, and payments, with advanced features such as dynamic stock alerts, highest sale reports, and role-based access control. The system is designed with a layered architecture for scalability and maintainability.

> ⚙️ Developed as a final degree project for Técnico Superior en Desarrollo de Software at a university, focusing on clean architecture, DTO usage, validations, `@ManyToMany` relationships via join entities, custom queries, and industry-standard backend development practices.

---

## 📁 Project Structure
```bash
    📦 store
    ├── 📂 controllers → REST endpoints for entities (e.g., MaterialController, PurchaseController)
    ├── 📂 dto → Data Transfer Objects (grouped by entity, e.g., material, purchase)
    ├── 📂 models → JPA entity classes (e.g., Material, Purchase, User)
    ├── 📂 repositories → JPA Repositories with custom queries (e.g., IMaterialRepository)
    ├── 📂 services
    │ ├── interfaces → Service layer contracts (e.g., IMaterialService)
    │ └── impl → Business logic implementations (e.g., MaterialService)
    ├── 📂 filters → Custom security filters (e.g., JwtAuthorizationFilter)
    ├── 📂 config → Security and app configuration (e.g., SecurityConfig)
    ├── 📂 utils → Utility classes (e.g., JWTUtil)
    ├── 📜 application.properties
    ├── 📜 StoreApplication.java
```

---

## 🔧 Tech Stack

 - Java 17 ☕
 - Spring Boot 3.5.0
 - Spring Data JPA
 - Spring Security with JWT
 - MySQL
 - Lombok
 - Jakarta Validation
 - Maven
 - IntelliJ IDEA
 - Postman (for testing)
 - JJWT (for JWT handling)
 - Argon2 (for password hashing)

---

## 🧩 Data Model

### 📦 `Material`
 - `Long idMaterial`
 - `String name`
 - `String brand`
 - `String brand`
 - `BigDecimal priceUsd`
 - `String measurementUnit`
 - `String internalNumber`
 - `String description`
 - `Family family`(ManyToOne)

### 📦 `Stock`
 - `Long idStock`
 - `BigDecimal quantityAvailable`
 - `LocalDate lastUpdate`
 - `Material material`(ManyToOne)
 - `Warehouse warehouse`(ManyToOne)

### 🚚 `Warehouse`
 - `Long idWarehouse`
 - `String address`
 - `String name`
 - `String location`

### 👥 `Client` & `Supplier`
 - `Long idClient`/`idSupplier`
 - `String name`
 - `String surname`
 - `String dni`
 - `String email`
 - `String address`
 - `String locality`
 - `String phoneNumber`

### 🛒 `Orders` & `Purchases`
 - `Long idOrders`/`idPurchase`
 - `LocalDate dateCreate`/`datePurchase`
 - `Client client`/`Supplier supplier`(ManyToOne)

### 📄 `OrderDetail` & `PurchaseDetail`
 - `Long idOrderDetail`/`idPurchaseDetail`
 - `BigDecimal quantity`
 - `BigDecimal priceUni`/`purchasedPrice`
 - `Orders orders`/`Purchase purchase`(ManyToOne)
 - `Material material`/`MaterialSupplier materialSupplier`(ManyToOne)

### 🚚 `Delivery`
 - `Long idDelivery`
 - `LocalDate deliveryDate`
 - `String status`
 - `Orders orders`(ManyToOne)

### 🧾 `Sale`
 - `Long idSale`
 - `LocalDate dateSale`
 - `Client client`(ManyToOne)
 - `Orders orders`(ManyToOne)
 - `Delivery delivery`(ManyToOne)

### 💳 `Payment`
 - `Long idPayment`
 - `BigDecimal amount`
 - `LocalDate datePayment`
 - `String methodPayment`
 - `String status`
 - `Sale sale`(ManyToOne)

### 📄 `MaterialSupplier`
 - `Long idMaterialSupplier`
 - `BigDecimal priceUnit`
 - `Integer deliveryTimeDays`
 - `Material material`(ManyToOne)
 - `Supplier supplier`(ManyToOne)

### 👤 `User`
 - `Long id`
 - `String username`(unique)
 - `String name`
 - `String lastName`
 - `String email`
 - `String phone`
 - `String password`(hashed)
 - `Role role`(ROLE_EMPLOYEE, ROLE_OWNER)
 - `boolean enabled`


---

## 🔄 Entity Relationships

 - `Family` (1) → `Material` (N) (ManyToOne)
 - `Material` (1) → `Stock` (N) (OneToMany)
 - `Warehouse` (1) → `Stock` (N) (OneToMany)
 - `Client` (1) → `Orders` (N) (OneToMany)
 - `Orders` (1) → `OrderDetail` (N) (OneToMany)
 - `Orders` (1) → `Delivery` (N) (OneToMany)
 - `Delivery` (1) → `Sale` (N) (OneToMany)
 - `Sale` (1) → `SaleDetail` (N) (OneToMany)
 - `Sale` (1) → `Payment` (N) (OneToMany)
 - `Material` (1) → `MaterialSupplier` (N) (OneToMany)
 - `Supplier` (1) → `MaterialSupplier` (N) (OneToMany)
 - `Supplier` (1) → `Purchase` (N) (OneToMany)
 - `Purchase` (1) → `PurchaseDetail` (N) (OneToMany)
 - `MaterialSupplier` (1) → `PurchaseDetail` (N) (OneToMany)


---

## 🔍 Features

### 📦 Materials
 - CRUD for materials
 - Alerts for low stock
 - Highest priced material
 - Total stock calculation

### 🚚 Warehouse & Stock
 - CRUD for warehouses and stock
 - Dynamic stock updates for purchases/sales

### 👥 Clients & Suppliers
 - CRUD for clients and suppliers
 - Role-based access for management

### 🚚 Deliveries
 - CRUD for deliveries with status tracking

### 🧾 Sales
 - CRUD for sales with details
 - Summary by date, highest sale

### 💳 Payments
 - CRUD for payments with status tracking

### 👤 Authentication & Users
 - User registration and login with JWT
 - Role-based access (EMPLOYEE, OWNER)

### 📈 Reports & KPIs
 - Top-selling product
 - Highest sale
 - Sales summary by date
 - Most expensive material
 - Low stock alerts (red for ≤10 units)


---

## ✅ Data Validation

Input validation is handled using Jakarta annotations like:

```
    @NotNull(message = "Supplier ID is required")
    @Size(min = 2, max = 100, message = "The name must be between 2 and 100 characters.")
```

Applied to DTOs such as ClientCreateDTO, ProductCreateDTO, and more.

---

### 🚀 How to Run

1. Clone the repo:

    ```bash
    https://github.com/Pipe-Garcia/store-app.git
    ```

2. Configure your MySQL database (application.properties):

```properties
   spring.datasource.url=jdbc:mysql://localhost:3306/store?useSSL=false&serverTimezone=UTC
   spring.datasource.username=root
   spring.datasource.password=
   spring.jpa.hibernate.ddl-auto=update
```

3. Run the app with:

```bash
   mvn clean install
   mvn spring-boot:run
```

4. Open in your browser or test with Postman:

```arduino
    http://localhost:8080
```

Use Postman or any REST client to test the API.

---

## 🧪 Postman Collection

Test all endpoints using a custom Postman collection (coming soon):

📂 [`Store-API.postman_collection`](./postman/Store%20App.postman_collection.json)

### ✅ Includes:
 - Full CRUD for Materials, Suppliers, Orders, Purchases, Sales, Payments, Deliveries, and Users
 - Authentication flows (register, login)
 - Advanced queries (top-selling product, low stock alerts, highest sale)
 - Role-based access tests

To use (once available):
1. Download or open the JSON file
2. Open Postman → `Import` → `File` → select the JSON
3. Run the requests!

---

## 💡 Future Enhancements
 - ✅ Implement advanced reports (e.g., sales/purchases by date, export to Excel/PDF)
 - ✅ Add auditing (log user actions for history tracking)
 - ✅ Enhance security with JWT role-based access
 - ✅ Integrate frontend with responsive template (Bootstrap or React)
 - Add Swagger/OpenAPI documentation
 - Add unit and integration tests
 - Dockerize for production
 - Deploy to Render / Railway / Fly.io

---

## 📬 Contact

If you'd like to collaborate or provide feedback, feel free to reach out:

### 👤 Felipe Garcia
- 📧 <a href="pipeg1069@gmail.com" target="_blank">pipeg1069@gmail.com</a>
- 💼 <a href="https://www.linkedin.com/in/felipe-garc%C3%ADa-dev/" target="_blank">LinkedIn</a>
- 🐙 <a href="https://github.com/Pipe-Garcia" target="_blank">GitHub</a>


### 👤 Marcos Mantovani
- 📧 <a href="marcossmantovanii@gmail.com" target="_blank">marcossmantovanii@gmail.com</a>
- 💼 <a href="https://www.linkedin.com/in/marcosmantovani/" target="_blank">LinkedIn</a>
- 🐙 <a href="https://github.com/marcos-manto" target="_blank">GitHub</a>

---

## ✨ Extra Notes

This app was developed as a hands-on Spring Boot project for a university final degree in Técnico Superior en Desarrollo de Software. It focuses on secure authentication and user management, and full inventory/sales/purchase tracking, showcasing layered architecture, JWT security, and scalable design principles.

---

## 👨‍🎓 Authors

- Developed by Felipe Garcia and Marcos Mantovani.

