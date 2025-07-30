package com.appTest.store.dto.client;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter @Setter
public class ClientUpdateDTO implements Serializable {

    @NotNull(message = "Client ID is required")
    private Long idClient;

    @Size(min = 2, max = 40, message = "Name must be between 2 and 40 characters")
    private String name;

    @Size(min = 2, max = 40, message = "Surname must be between 2 and 40 characters")
    private String surname;

    @Size(min = 7, max = 10, message = "DNI must be between 7 and 10 digits")
    private String dni;

    @Size(min = 2, max = 40, message = "Email must be between 10 and 40 characters")
    private String email;

    @Size(min = 2, max = 40, message = "Address must be between 10 and 40 characters")
    private String address;

    @Size(min = 2, max = 40, message = "Locality must be between 10 and 40 characters")
    private String locality;

    @Size(min = 2, max = 40, message = "Phone number must be between 6 and 40 numbers")
    private String phoneNumber;

    @Pattern(regexp = "ACTIVE|INACTIVE", message = "The status must be ACTIVE or INACTIVE")
    private String status;
}

