package com.appTest.store.services;

import com.appTest.store.dto.client.ClientCreateDTO;
import com.appTest.store.dto.client.ClientDTO;
import com.appTest.store.dto.client.ClientUpdateDTO;
import com.appTest.store.models.Client;
import com.appTest.store.models.Orders;
import com.appTest.store.repositories.IClientRepository;
import com.appTest.store.repositories.IOrdersRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ClientService implements IClientService{

    @Autowired private IClientRepository repoClient;
    @Autowired private IOrdersRepository repoOrders;

    @Autowired private AuditService audit;

    /* ===== Utils auditoría ===== */

    private Map<String,Object> snap(Client c){
        if (c==null) return null;
        Map<String,Object> m = new LinkedHashMap<>();
        m.put("id",        c.getIdClient());
        m.put("nombre",    c.getName());
        m.put("apellido",  c.getSurname());
        m.put("dni",       c.getDni());
        m.put("email",     c.getEmail());
        m.put("direccion", c.getAddress());
        m.put("localidad", c.getLocality());
        m.put("telefono",  c.getPhoneNumber());
        m.put("estado",    c.getStatus());
        return m;
    }
    private record Change(String field, Object from, Object to) {}
    private List<Change> diff(Map<String,Object> a, Map<String,Object> b){
        List<Change> out = new ArrayList<>();
        Set<String> ks = new LinkedHashSet<>();
        if (a!=null) ks.addAll(a.keySet());
        if (b!=null) ks.addAll(b.keySet());
        for (String k: ks){
            Object va = a!=null? a.get(k) : null;
            Object vb = b!=null? b.get(k) : null;
            if (!Objects.equals(va, vb)) out.add(new Change(k, va, vb));
        }
        return out;
    }
    private String human(String k){
        return switch (k){
            case "nombre"->"Nombre"; case "apellido"->"Apellido"; case "dni"->"DNI";
            case "email"->"Email"; case "direccion"->"Dirección"; case "localidad"->"Localidad";
            case "telefono"->"Teléfono"; case "estado"->"Estado"; default->k;
        };
    }
    private String fmt(Object v){ return (v==null || String.valueOf(v).isBlank()) ? "—" : String.valueOf(v); }
    private String summarize(List<Change> ch){
        if (ch==null || ch.isEmpty()) return "OK";
        String s = ch.stream().limit(3)
                .map(c -> human(c.field()) + ": " + fmt(c.from()) + " → " + fmt(c.to()))
                .collect(Collectors.joining(" · "));
        if (ch.size()>3) s += " +" + (ch.size()-3) + " más";
        return s;
    }
    private void afterCommit(Runnable r){
        if (TransactionSynchronizationManager.isSynchronizationActive()){
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit(){ r.run(); }
            });
        } else r.run();
    }

    /* ===== Reglas de unicidad ===== */

    private void validateUniqueClient(String dni, String email, Long currentId){
        String normalizedDni = (dni != null) ? dni.trim() : null;
        String normalizedEmail = (email != null) ? email.trim() : null;

        if (normalizedDni != null && !normalizedDni.isBlank()){
            repoClient.findByDni(normalizedDni).ifPresent(existing -> {
                if (currentId == null || !Objects.equals(existing.getIdClient(), currentId)) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "A client with DNI " + normalizedDni + " already exists"
                    );
                }
            });
        }

        if (normalizedEmail != null && !normalizedEmail.isBlank()){
            repoClient.findByEmail(normalizedEmail).ifPresent(existing -> {
                if (currentId == null || !Objects.equals(existing.getIdClient(), currentId)) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "A client with email " + normalizedEmail + " already exists"
                    );
                }
            });
        }
    }

    /* ===== API ===== */

    @Override
    public List<Client> getAllClients(Boolean includeDeleted) {
        // Lógica de filtrado: Si includeDeleted es true, devuelve todo. Si no, solo ACTIVE.
        if (Boolean.TRUE.equals(includeDeleted)) {
            return repoClient.findAll();
        } else {
            return repoClient.findByStatus("ACTIVE");
        }
    }

    @Override
    public ClientDTO convertClientToDto(Client client) {
        int quantSales = (client.getSales() != null) ? client.getSales().size() : 0;
        Orders latestOrder = repoOrders.findTopByClientOrderByDateCreateDesc(client).orElse(null);
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


    @Override
    @Transactional
    public ClientDTO createClient(ClientCreateDTO dto) {

        validateUniqueClient(dto.getDni(), dto.getEmail(), null);

        Client client = new Client();
        client.setName(dto.getName());
        client.setSurname(dto.getSurname());
        client.setDni(dto.getDni());
        client.setEmail(dto.getEmail());
        client.setAddress(dto.getAddress());
        client.setLocality(dto.getLocality());
        client.setPhoneNumber(dto.getPhoneNumber());
        // Forzamos ACTIVE al crear si no viene, o usamos el del DTO
        client.setStatus(dto.getStatus() != null ? dto.getStatus() : "ACTIVE");

        repoClient.save(client);

        final Long cid = client.getIdClient();
        final String display = (client.getName()+" "+client.getSurname()).trim();
        final Map<String,Object> after = snap(client);

        afterCommit(() -> {
            Long ev = audit.success("CLIENT_CREATE", "Client", cid,
                    "Creado cliente \"" + display + "\"");
            Map<String,Object> diff = Map.of("created", true, "fields", after);
            audit.attachDiff(ev, null, after, diff);
        });

        return convertClientToDto(client);
    }


    @Override
    @Transactional
    public void updateClient(ClientUpdateDTO dto) {
        Client client = repoClient.findById(dto.getIdClient()).orElse(null);
        if (client == null) return;

        String newDni = (dto.getDni() != null) ? dto.getDni() : client.getDni();
        String newEmail = (dto.getEmail() != null) ? dto.getEmail() : client.getEmail();
        validateUniqueClient(newDni, newEmail, client.getIdClient());

        Map<String,Object> before = snap(client);

        if (dto.getName()        != null) client.setName(dto.getName());
        if (dto.getSurname()     != null) client.setSurname(dto.getSurname());
        if (dto.getDni()         != null) client.setDni(dto.getDni());
        if (dto.getEmail()       != null) client.setEmail(dto.getEmail());
        if (dto.getAddress()     != null) client.setAddress(dto.getAddress());
        if (dto.getLocality()    != null) client.setLocality(dto.getLocality());
        if (dto.getPhoneNumber() != null) client.setPhoneNumber(dto.getPhoneNumber());
        if (dto.getStatus()      != null) client.setStatus(dto.getStatus());

        repoClient.save(client);

        Map<String,Object> after = snap(client);
        List<Change> changes = diff(before, after);
        String message = summarize(changes);

        final Long cid = client.getIdClient();
        final List<Map<String,Object>> changed = changes.stream()
                .map(c -> Map.of("field", c.field(), "from", c.from(), "to", c.to()))
                .collect(Collectors.toList());
        final Map<String,Object> payload = Map.of("changed", changed);

        afterCommit(() -> {
            Long ev = audit.success("UPDATE", "Client", cid, message);
            audit.attachDiff(ev, before, after, payload);
        });
    }

    @Override
    @Transactional
    // Ya no usamos @Auditable automático porque hacemos soft delete manual
    public void deleteClientById(Long idClient) {
        Client client = repoClient.findById(idClient).orElse(null);
        if (client == null) return;

        // 1. Snapshot antes
        Map<String,Object> before = snap(client);

        // 2. Soft Delete
        client.setStatus("INACTIVE");
        repoClient.save(client);

        // 3. Auditoría Manual
        Map<String,Object> after = snap(client);
        final Long cid = client.getIdClient();

        // Calculamos el diff manual solo del status
        List<Map<String,Object>> changed = List.of(
                Map.of("field", "status", "from", "ACTIVE", "to", "INACTIVE")
        );
        final Map<String,Object> payload = Map.of("changed", changed);

        afterCommit(() -> {
            Long ev = audit.success("SOFT_DELETE", "Client", cid, "Cliente deshabilitado (Soft Delete)");
            audit.attachDiff(ev, before, after, payload);
        });
    }

    @Override
    @Transactional
    public void restoreClient(Long idClient) {
        Client client = repoClient.findById(idClient).orElse(null);
        if (client == null) return;

        // 1. Snapshot antes
        Map<String,Object> before = snap(client);

        // 2. Restore
        client.setStatus("ACTIVE");
        repoClient.save(client);

        // 3. Auditoría Manual
        Map<String,Object> after = snap(client);
        final Long cid = client.getIdClient();

        // Calculamos el diff manual
        List<Map<String,Object>> changed = List.of(
                Map.of("field", "status", "from", "INACTIVE", "to", "ACTIVE")
        );
        final Map<String,Object> payload = Map.of("changed", changed);

        afterCommit(() -> {
            Long ev = audit.success("RESTORE", "Client", cid, "Cliente restaurado");
            audit.attachDiff(ev, before, after, payload);
        });
    }
}