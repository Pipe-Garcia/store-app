package com.appTest.bazar.services;

import com.appTest.bazar.dto.client.ClientCreateDTO;
import com.appTest.bazar.dto.client.ClientUpdateDTO;
import com.appTest.bazar.models.Client;

import java.util.List;

public interface IClientService {

    public List<Client> getAllClientes();

    public com.appTest.bazar.dto.client.ClientDTO convertClientToDto (Client client);

    public Client getClientById (Long idClient);

    public void createClient(ClientCreateDTO dto);

    public void updateClient(ClientUpdateDTO dto);

    public void deleteClientById(Long idClient);
}
