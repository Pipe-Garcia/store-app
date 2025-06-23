package com.appTest.store.services;

import com.appTest.store.dto.client.ClientCreateDTO;
import com.appTest.store.dto.client.ClientUpdateDTO;
import com.appTest.store.models.Client;

import java.util.List;

public interface IClientService {

    public List<Client> getAllClientes();

    public com.appTest.store.dto.client.ClientDTO convertClientToDto (Client client);

    public Client getClientById (Long idClient);

    public void createClient(ClientCreateDTO dto);

    public void updateClient(ClientUpdateDTO dto);

    public void deleteClientById(Long idClient);
}
