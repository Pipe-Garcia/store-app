package com.appTest.store.services;

import com.appTest.store.dto.client.ClientCreateDTO;
import com.appTest.store.dto.client.ClientDTO;
import com.appTest.store.dto.client.ClientUpdateDTO;
import com.appTest.store.dto.orders.OrdersDTO;
import com.appTest.store.models.Client;
import com.appTest.store.models.Orders;
import com.appTest.store.repositories.IClientRepository;
import com.appTest.store.repositories.IOrdersRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

@Service
public class ClientService implements IClientService{

    @Autowired
    private IClientRepository repoClient;

    @Autowired
    
    private IOrdersRepository repoOrders;
//    @Autowired
//    
//    private AuditService auditService;
//
//    public ClientService(IClientRepository repoClient, AuditService auditService) {
//        this.repoClient=repoClient;
//        this.auditService=auditService;
//    }

    @Override
    public List<Client> getAllClients() {
        return repoClient.findAll();
    }

    @Override
    public ClientDTO convertClientToDto(Client client) {
        int quantSales = (client.getSales() != null) ? client.getSales().size() : 0;

        Orders latestOrder = repoOrders
                .findTopByClientOrderByDateCreateDesc(client)
                .orElse(null);

        Long latestOrdersId = (latestOrder != null) ? latestOrder.getIdOrders() : null;
        return new ClientDTO(
                client.getIdClient(),
                client.getName(),
                client.getSurname(),
                quantSales,
                client.getDni(),
                client.getEmail(),
                client.getAddress(),
                client.getLocality(),
                client.getPhoneNumber(),
                client.getStatus(),
                latestOrdersId
        );
    }


    @Override
    public Client getClientById(Long idClient) {
        return repoClient.findById(idClient).orElse(null);
    }

    public Orders findLatestOrderByClient(Client client) {
        return client.getOrders().stream()
                .max(Comparator.comparing(Orders::getDateCreate))
                .orElse(null);
    }


    @Override
    @Transactional
    public ClientDTO createClient(ClientCreateDTO dto) {
        Client client = new Client();
        client.setName(dto.getName());
        client.setSurname(dto.getSurname());
        client.setDni(dto.getDni());
        client.setEmail(dto.getEmail());
        client.setAddress(dto.getAddress());
        client.setLocality(dto.getLocality());
        client.setPhoneNumber(dto.getPhoneNumber());
        client.setStatus(dto.getStatus());

        repoClient.save(client);

        return convertClientToDto(client);
    }

    @Override
    @Transactional
    public void updateClient(ClientUpdateDTO dto) {
        Client client = repoClient.findById(dto.getIdClient()).orElse(null);

        if (client != null) {
            if (dto.getName() != null) client.setName(dto.getName());
            if (dto.getSurname() != null) client.setSurname(dto.getSurname());
            if (dto.getDni() != null) client.setDni(dto.getDni());
            if (dto.getEmail() != null) client.setEmail(dto.getEmail());
            if (dto.getAddress() != null) client.setAddress(dto.getAddress());
            if (dto.getLocality() != null) client.setLocality(dto.getLocality());
            if (dto.getPhoneNumber() != null) client.setPhoneNumber(dto.getPhoneNumber());
            if (dto.getStatus() != null) client.setStatus(dto.getStatus());

            repoClient.save(client);
        }
    }

    @Override
    @Transactional
    public void deleteClientById(Long idClient) {
        repoClient.deleteById(idClient);
    }
}
