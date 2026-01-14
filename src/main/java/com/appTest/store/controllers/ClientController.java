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
@RequestMapping ("/clients")
public class ClientController {

    @Autowired
    private IClientService servClient;

    @Autowired
    private IClientRepository repoClient;

    // 1. GET con Filtro de Eliminados
    // Usamos hasAnyAuthority para evitar problemas con el prefijo "ROLE_"
    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<ClientDTO>> getAllClients(
            @RequestParam(required = false) Boolean includeDeleted
    ) {
        // Pasamos el parámetro al servicio
        List<Client> clientList = servClient.getAllClients(includeDeleted);

        List<ClientDTO> clientDTOList = clientList.stream()
                .map(client -> servClient.convertClientToDto(client))
                .collect(Collectors.toList());
        return ResponseEntity.ok(clientDTOList);
    }

    @GetMapping ("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<ClientDTO> getClientById(@PathVariable Long id) {
        Client client = servClient.getClientById(id);

        if (client == null) {
            return ResponseEntity.notFound().build();
        }

        ClientDTO clientDTO = servClient.convertClientToDto(client);

        return ResponseEntity.ok(clientDTO);
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<ClientDTO> createClient(@RequestBody @Valid ClientCreateDTO dto) {
        ClientDTO createdClient = servClient.createClient(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdClient);
    }

    @PutMapping
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<ClientDTO> updateClient(@RequestBody @Valid ClientUpdateDTO dto) {
        servClient.updateClient(dto);
        Client client = repoClient.findById(dto.getIdClient())
                .orElseThrow(() -> new EntityNotFoundException("Client not found"));
        return ResponseEntity.ok(servClient.convertClientToDto(client));
    }

    // 2. DELETE (Soft Delete)
    // Corregido: hasAuthority en lugar de hasRole para evitar el error 403
    @DeleteMapping ("/{id}")
    @PreAuthorize("hasAuthority('ROLE_OWNER')")
    public ResponseEntity<String> deleteClientById(@PathVariable Long id) {
        Client client = servClient.getClientById(id);

        if (client != null) {
            servClient.deleteClientById(id);
            return ResponseEntity.ok().body("The client has been disabled (Soft Delete).");
        }

        return ResponseEntity.notFound().build();
    }

    // 3. RESTORE (Nuevo Endpoint)
    // Corregido: hasAuthority en lugar de hasRole
    @PutMapping("/{id}/restore")
    @PreAuthorize("hasAuthority('ROLE_OWNER')")
    public ResponseEntity<String> restoreClientById(@PathVariable Long id) {
        Client client = servClient.getClientById(id);

        if (client != null) {
            servClient.restoreClient(id);
            return ResponseEntity.ok().body("The client has been restored successfully.");
        }

        return ResponseEntity.notFound().build();
    }
}