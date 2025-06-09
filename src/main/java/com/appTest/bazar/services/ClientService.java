package com.appTest.bazar.services;

import com.appTest.bazar.dto.client.ClientCreateDTO;
import com.appTest.bazar.dto.client.ClientDTO;
import com.appTest.bazar.dto.client.ClientUpdateDTO;
import com.appTest.bazar.models.Client;
import com.appTest.bazar.repositories.IClientRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ClientService implements IClientService{

    @Autowired
    private IClientRepository repoClient;

    @Override
    public List<Client> getAllClientes() {
        return repoClient.findAll();
    }

    @Override
    public ClientDTO convertClientToDto(Client client) {
        int quantSales = (client.getSales() != null) ? client.getSales().size() : 0;

        return new ClientDTO(
                client.getName(),
                client.getSurname(),
                quantSales,
                client.getDni()
        );
    }

    @Override
    public Client getClientById(Long idClient) {
        return repoClient.findById(idClient).orElse(null);
    }

    @Override
    public void createClient(ClientCreateDTO dto) {
        Client client = new Client();
        client.setName(dto.getName());
        client.setSurname(dto.getSurname());
        client.setDni(dto.getDni());

        repoClient.save(client);
    }

    @Override
    public void updateClient(ClientUpdateDTO dto) {
        Client client = repoClient.findById(dto.getIdClient()).orElse(null);

        if (client != null) {
            if (dto.getName() != null) client.setName(dto.getName());
            if (dto.getSurname() != null) client.setSurname(dto.getSurname());
            if (dto.getDni() != null) client.setDni(dto.getDni());

            repoClient.save(client);
        }
    }

    @Override
    public void deleteClientById(Long idClient) {
        repoClient.deleteById(idClient);
    }
}
