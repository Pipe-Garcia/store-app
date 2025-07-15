package com.appTest.store.dto.client;

import jakarta.validation.constraints.NotNull;
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

    @Size(min = 5, max = 100, message = "Email must be between 5 and 100 characters")
    private String email;

}

