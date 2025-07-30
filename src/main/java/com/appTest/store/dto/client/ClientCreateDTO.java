package com.appTest.store.dto.client;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter @Setter
public class ClientCreateDTO implements Serializable {

    @NotBlank(message = "Name cannot be blank")
    @Size(min = 2, max = 40, message = "Name must be between 2 and 40 characters")
    private String name;

    @NotBlank(message = "Surname cannot be blank")
    @Size(min = 2, max = 40, message = "Surname must be between 2 and 40 characters")
    private String surname;

    @NotBlank(message = "DNI is required")
    @Size(min = 7, max = 10, message = "DNI must be between 7 and 10 digits")
    private String dni;

    @Email(message = "Email must be valid.")
    private String email;

    @NotBlank(message = "Address is required")
    @Size(min = 2, max = 40, message = "Address must be between 2 and 40 characters")
    private String address;

    @NotBlank(message = "Locality is required")
    @Size(min = 2, max = 40, message = "Locality must be between 2 and 40 characters")
    private String locality;

    @NotBlank(message = "Phone number is required")
    @Size(min = 6, max = 30, message = "Phone number must be between 6 and 40 characters")
    private String phoneNumber;

    @NotNull(message = "Status is required")
    @Pattern(regexp = "ACTIVE|INACTIVE", message = "The status must be ACTIVE or INACTIVE")
    private String status;
}
