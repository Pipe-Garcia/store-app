package com.appTest.store.controllers;

import com.appTest.store.dto.client.ClientCreateDTO;
import com.appTest.store.dto.client.ClientDTO;
import com.appTest.store.dto.client.ClientUpdateDTO;
import com.appTest.store.models.Client;
import com.appTest.store.repositories.IClientRepository;
import com.appTest.store.services.IClientService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/clients")
public class ClientController {

    @Autowired
    private IClientService servClient;

    @Autowired
    private IClientRepository repoClient;

    @GetMapping
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')")
    public ResponseEntity<List<ClientDTO>> getAllClients(
            @RequestParam(required = false) Boolean includeDeleted
    ) {
        List<Client> clientList = servClient.getAllClients(includeDeleted);
        List<ClientDTO> clientDTOList = clientList.stream()
                .map(servClient::convertClientToDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(clientDTOList);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')")
    public ResponseEntity<ClientDTO> getClientById(@PathVariable Long id) {
        Client client = servClient.getClientById(id);
        if (client == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(servClient.convertClientToDto(client));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')")
    public ResponseEntity<ClientDTO> createClient(@RequestBody @Valid ClientCreateDTO dto) {
        ClientDTO createdClient = servClient.createClient(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdClient);
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')")
    public ResponseEntity<ClientDTO> updateClient(@RequestBody @Valid ClientUpdateDTO dto) {
        servClient.updateClient(dto);
        Client client = repoClient.findById(dto.getIdClient())
                .orElseThrow(() -> new EntityNotFoundException("Client not found"));
        return ResponseEntity.ok(servClient.convertClientToDto(client));
    }


    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<String> deleteClientById(@PathVariable Long id) {
        Client client = servClient.getClientById(id);
        if (client != null) {
            servClient.deleteClientById(id);
            return ResponseEntity.ok("The client has been disabled (Soft Delete).");
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}/restore")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<String> restoreClientById(@PathVariable Long id) {
        Client client = servClient.getClientById(id);
        if (client != null) {
            servClient.restoreClient(id);
            return ResponseEntity.ok("The client has been restored successfully.");
        }
        return ResponseEntity.notFound().build();
    }
}
