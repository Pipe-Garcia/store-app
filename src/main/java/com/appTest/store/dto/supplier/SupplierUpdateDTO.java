package com.appTest.store.dto.supplier;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class SupplierUpdateDTO implements Serializable {

    @NotNull(message = "Supplier ID is required")
    private Long idSupplier;

    @Size(min = 2, max = 100, message = "The name must be between 2 and 100 characters.")
    private String name;

    @Size(max = 100, message = "The surname cannot exceed 100 characters.")
    private String surname;

    @Size(min = 7, max = 10, message = "DNI must be between 7 and 10 digits")
    private String dni;

    @Email(message = "The email must be valid")
    private String email;

    @Size(max = 100, message = "The address cannot exceed 100 characters.")
    private String address;

    @Size(max = 100, message = "The location cannot exceed 100 characters.")
    private String locality;

    @Size(min = 2, max = 100, message = "The company name must be between 2 and 100 characters.")
    private String nameCompany;

    private String phoneNumber;

    @Pattern(regexp = "ACTIVE|INACTIVE", message = "The status must be ACTIVE or INACTIVE")
    private String status;
}
