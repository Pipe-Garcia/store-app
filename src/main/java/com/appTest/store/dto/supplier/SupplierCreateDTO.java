package com.appTest.store.dto.supplier;

import com.appTest.store.dto.materialSupplier.MaterialSupplierCreateDTO;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.List;

@Getter
@Setter
public class SupplierCreateDTO implements Serializable {

    @NotNull(message = "Name is required")
    @Size(min = 2, max = 100, message = "The name must be between 2 and 100 characters.")
    private String name;

    @Size(max = 100, message = "The surname cannot exceed 100 characters.")
    private String surname;

    @NotBlank(message = "DNI is required.")
    @Size(min = 7, max = 10, message = "DNI must be between 7 and 10 digits")
    @Pattern(regexp = "^[0-9]+$", message = "DNI must contain only digits")
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

    @NotBlank(message = "Phone number is required.")
    @Size(min = 6, max = 30, message = "Phone number must be between 6 and 30 characters")
    @Pattern(
            regexp = "^\\+?[0-9\\s-]{6,30}$",
            message = "Phone number format is invalid"
    )
    private String phoneNumber;


    @NotNull(message = "Status is required")
    @Pattern(regexp = "ACTIVE|INACTIVE", message = "The status must be ACTIVE or INACTIVE")
    private String status;

    // ✅ Lista de materiales que provee
    private List<MaterialSupplierCreateDTO> materials;
}
