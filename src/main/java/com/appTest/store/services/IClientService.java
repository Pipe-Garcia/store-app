package com.appTest.store.services;

import com.appTest.store.dto.client.ClientCreateDTO;
import com.appTest.store.dto.client.ClientDTO;
import com.appTest.store.dto.client.ClientUpdateDTO;
import com.appTest.store.models.Client;

import java.util.List;

public interface IClientService {

    // Modificado para aceptar filtro de eliminados
    public List<Client> getAllClients(Boolean includeDeleted);

    public com.appTest.store.dto.client.ClientDTO convertClientToDto (Client client);

    public Client getClientById (Long idClient);

    public ClientDTO createClient(ClientCreateDTO dto);

    public void updateClient(ClientUpdateDTO dto);

    public void deleteClientById(Long idClient);

    // Nuevo método para restaurar
    public void restoreClient(Long idClient);
}