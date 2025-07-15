package com.appTest.store.services;

import com.appTest.store.dto.saleDetail.SaleDetailRequestDTO;
import com.appTest.store.dto.sale.*;
import com.appTest.store.models.Client;
import com.appTest.store.models.Material;
import com.appTest.store.models.SaleDetail;
import com.appTest.store.models.Sale;
import com.appTest.store.repositories.IClientRepository;
import com.appTest.store.repositories.IMaterialRepository;
import com.appTest.store.repositories.ISaleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class SaleService implements ISaleService{

    @Autowired
    private ISaleRepository repoSale;

    @Autowired
    @Lazy
    private IClientRepository repoClient;

    @Autowired
    @Lazy
    private IMaterialRepository repoMat;

    @Autowired
    @Lazy
    private IStockService servStock;

    @Override
    public List<Sale> getAllSales() {
        return repoSale.findAll();
    }

    @Override
    public Sale getSaleById(Long idSale) {
        return repoSale.findById(idSale).orElse(null);
    }

    @Override
    public SaleDTO convertSaleToDto(Sale sale) {
        String nameClient = (sale.getClient() != null) ? sale.getClient().getName() : "Name not found";
        String surnameClient = (sale.getClient() != null) ? sale.getClient().getSurname() : "Surname not found";

        String completeNameClient = nameClient + " " + surnameClient;

        String paymentMethod = sale.getPaymentList().isEmpty() ? "Not specified"
                : sale.getPaymentList().get(0).getMethodPayment();

        BigDecimal total  = calculateTotal(sale);

        Long deliveryId = sale.getDelivery().getIdDelivery();

        LocalDate deliveryDate = sale.getDelivery().getDeliveryDate();

        return new SaleDTO(
                sale.getIdSale(),
                completeNameClient,
                sale.getDateSale(),
                total,
                paymentMethod,
                deliveryId,
                deliveryDate
        );
    }

    private BigDecimal calculateTotal(Sale sale) {
        return sale.getSaleDetailList().stream()
                .map(detail -> detail.getQuantity().multiply(detail.getPriceUni()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Override
    public SaleSummaryByDateDTO getSaleSummaryByDate(LocalDate date) {
        return repoSale.getSaleSummaryByDate(date);
    }

    @Override
    public SaleHighestDTO getHighestSale() {
        List<SaleHighestDTO> list = repoSale.getHighestSale();
        return list.isEmpty() ? null : list.get(0);
    }


    @Override
    public void createSale(SaleCreateDTO dto) {
        Sale sale = new Sale();
        sale.setDateSale(dto.getDateSale());

        Client client = repoClient.findById(dto.getClientId())
                .orElseThrow(() -> new RuntimeException("Client not found with ID: " + dto.getClientId()));
        sale.setClient(client);

        List<SaleDetail> saleDetailList = new ArrayList<>();

        for (SaleDetailRequestDTO item : dto.getMaterials()) {
            Material material = repoMat.findById(item.getMaterialId())
                    .orElseThrow(() -> new RuntimeException("Material not found with ID: " + item.getMaterialId()));
            if (material != null) {
                SaleDetail ps = new SaleDetail();
                ps.setMaterial(material);
                ps.setSale(sale);
                ps.setQuantity(item.getQuantity());
                ps.setPriceUni(material.getPriceArs());

                saleDetailList.add(ps);
                servStock.decreaseStock(item.getMaterialId(), item.getWarehouseId(), item.getQuantity());

            }
        }
        sale.setSaleDetailList(saleDetailList);

        repoSale.save(sale);
    }


    @Override
    public void updateSale(SaleUpdateDTO dto) {
            Sale sale = repoSale.findById(dto.getIdSale()).orElse(null);

            if (sale != null) {
                if (dto.getDateSale() != null) sale.setDateSale(dto.getDateSale());

                if (dto.getClientId() != null) {
                    Client client = repoClient.findById(dto.getClientId()).orElse(null);
                    sale.setClient(client);
                };

                repoSale.save(sale);
            }
    }

    @Override
    public void deleteSaleById(Long idSale) {
            repoSale.deleteById(idSale);
    }
}
