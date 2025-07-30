package com.appTest.store.dto.supplier;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class SupplierCreateDTO implements Serializable {
    @NotNull(message = "Name is required")
    @Size(min = 2, max = 100, message = "The name must be between 2 and 100 characters.")
    private String name;

    @Size(max = 100, message = "The surname cannot exceed 100 characters.")
    private String surname;

    @NotNull(message = "DNI is required.")
    private String dni;

    @Email(message = "The email must be valid.")
    private String email;

    @NotNull(message = "Address is required.")
    @Size(max = 100, message = "The address cannot exceed 100 characters.")
    private String address;

    @Size(max = 100, message = "The location cannot exceed 100 characters.")
    private String locality;

    @NotNull(message = "The name company is required.")
    @Size(min = 2, max = 100, message = "The company name must be between 2 and 100 characters.")
    private String nameCompany;

    @NotNull(message = "Phone number is required.")
    private String phoneNumber;

    @NotNull(message = "Status is required")
    @Pattern(regexp = "ACTIVE|INACTIVE", message = "The status must be ACTIVE or INACTIVE")
    private String status;
}
