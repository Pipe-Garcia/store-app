package com.appTest.bazar.controllers;

import com.appTest.bazar.dto.client.ClientCreateDTO;
import com.appTest.bazar.dto.client.ClientDTO;
import com.appTest.bazar.dto.client.ClientUpdateDTO;
import com.appTest.bazar.models.Client;
import com.appTest.bazar.services.IClientService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping ("/clients")
public class ClientController {

    @Autowired
    private IClientService servClient;

    @GetMapping
    public ResponseEntity<List<ClientDTO>> getAllClients() {
        List<Client> clientList = servClient.getAllClientes();
        List<ClientDTO> clientDTOList = clientList.stream()
                                        .map(client -> servClient.convertClientToDto(client))
                                        .collect(Collectors.toList());
        return ResponseEntity.ok(clientDTOList);
    }

    @GetMapping ("/{id}")
    public ResponseEntity<ClientDTO> getClientById(@PathVariable Long id) {
        Client client = servClient.getClientById(id);

        if (client == null) {
            return ResponseEntity.notFound().build();
        }

        ClientDTO clientDTO = servClient.convertClientToDto(client);

        return ResponseEntity.ok(clientDTO);
    }

    @PostMapping
    public ResponseEntity<String> createClient(@RequestBody @Valid ClientCreateDTO dto) {
        servClient.createClient(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body("The client has been successfully created.");
    }

    @PutMapping
    public ResponseEntity<String> updateClient(@RequestBody ClientUpdateDTO dto) {
        servClient.updateClient(dto);
        return ResponseEntity.ok().body("The client has been successfully updated.");
    }

    @DeleteMapping ("/{id}")
    public ResponseEntity<String> deleteClientById(@PathVariable Long id) {
        Client client = servClient.getClientById(id);

        if (client != null) {
            servClient.deleteClientById(id);
            return ResponseEntity.ok().body("The client has been successfully eliminated.");
        }

        return ResponseEntity.notFound().build();
    }
}
