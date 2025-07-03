package com.appTest.store.dto.client;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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

    @NotBlank(message = "Email is required")
    @Size(min = 2, max = 40, message = "Email must be between 10 and 40 characters")
    private String email;

    @NotBlank(message = "Address is required")
    @Size(min = 2, max = 40, message = "Address must be between 10 and 40 characters")
    private String address;

    @NotBlank(message = "Locality is required")
    @Size(min = 2, max = 40, message = "Locality must be between 10 and 40 characters")
    private String locality;

    @NotBlank(message = "Phone number is required")
    @Size(min = 2, max = 40, message = "Phone number must be between 6 and 40 numbers")
    private Long phoneNumber;
}
