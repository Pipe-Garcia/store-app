package com.appTest.store.services;

import com.appTest.store.dto.saleDetail.SaleDetailRequestDTO;
import com.appTest.store.dto.sale.*;
import com.appTest.store.models.*;
import com.appTest.store.repositories.*;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
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
    private IClientRepository repoClient;

    @Autowired
    private IMaterialRepository repoMat;

    @Autowired
    private IPaymentRepository repoPayment;

    @Autowired
    private IDeliveryRepository repoDelivery;

    @Autowired
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

        Long deliveryId = (sale.getDelivery() != null) ? sale.getDelivery().getIdDelivery() : null;



        return new SaleDTO(
                sale.getIdSale(),
                completeNameClient,
                sale.getDateSale(),
                total,
                paymentMethod,
                deliveryId
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
    @Transactional
    public SaleDTO createSale(SaleCreateDTO dto) {
        Sale sale = new Sale();
        sale.setDateSale(dto.getDateSale());

        Client client = repoClient.findById(dto.getClientId())
                .orElseThrow(() -> new EntityNotFoundException("Client not found with ID: " + dto.getClientId()));
        sale.setClient(client);

        List<SaleDetail> saleDetailList = new ArrayList<>();

        for (SaleDetailRequestDTO item : dto.getMaterials()) {
            Material material = repoMat.findById(item.getMaterialId())
                    .orElseThrow(() -> new EntityNotFoundException("Material not found with ID: " + item.getMaterialId()));
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

        Sale savedSale = repoSale.save(sale);


        if (dto.getPayment() != null) {
            Payment payment = new Payment();
            payment.setAmount(dto.getPayment().getAmount());
            payment.setDatePayment(dto.getPayment().getDatePayment());
            payment.setMethodPayment(dto.getPayment().getMethodPayment());
            BigDecimal totalPaid = savedSale.getPaymentList().stream()
                    .map(Payment::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .add(dto.getPayment().getAmount());
            BigDecimal saleTotal = calculateTotal(savedSale);
            payment.setStatus(calculatePaymentStatus(totalPaid, saleTotal));
            payment.setSale(savedSale);
            repoPayment.save(payment);
        }

        if (dto.getDeliveryId() != null) {
            Delivery delivery = repoDelivery.findById(dto.getDeliveryId())
                    .orElseThrow(() -> new EntityNotFoundException("Delivery not found with ID: " + dto.getDeliveryId()));
            sale.setDelivery(delivery);
        }


        return convertSaleToDto(savedSale);
    }


    private String calculatePaymentStatus(BigDecimal totalPaid, BigDecimal saleTotal) {
        if (totalPaid.compareTo(BigDecimal.ZERO) == 0) {
            return "PENDING";
        } else if (totalPaid.compareTo(saleTotal) < 0) {
            return "PARTIAL";
        } else {
            return "PAID";
        }
    }

    @Override
    @Transactional
    public void updateSale(SaleUpdateDTO dto) {
        Sale sale = repoSale.findById(dto.getIdSale())
                .orElseThrow(() -> new EntityNotFoundException("Sale not found"));
        if (dto.getDateSale() != null) sale.setDateSale(dto.getDateSale());
        if (dto.getClientId() != null) {
            Client client = repoClient.findById(dto.getClientId())
                    .orElseThrow(() -> new EntityNotFoundException("Client not found"));
            sale.setClient(client);
        }
        repoSale.save(sale);
    }

    @Override
    @Transactional
    public void deleteSaleById(Long idSale) {
        repoSale.deleteById(idSale);
    }
}
